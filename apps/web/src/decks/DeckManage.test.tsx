// The maintainer, 20 Oct 2026: "A deck should be able to be toggled private/public. It should be
// able to be renamed. It should be able to be deleted with a confirmation."
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { fakeAuthService } from "../test/fakeAuthService.ts";
import { fakeDeckRepository } from "../test/fakeDeckRepository.ts";
import { renderApp } from "../test/renderApp.tsx";

async function open(ownerId = "u1", isPublic = false) {
  const fake = fakeDeckRepository([
    {
      id: "deck-1",
      name: "Gate tempo",
      updatedAt: "2026-10-14T10:00:00Z",
      ownerId,
      isPublic,
      cards: [{ variantId: "hp1", quantity: 3, sideboard: false }],
      pitchTargets: {},
    },
  ]);
  const { router } = await renderApp({
    path: "/decks/deck-1",
    auth: fakeAuthService({
      users: { "u@test.local": { id: "u1", password: "pw", role: "user" } },
      signedIn: { id: "u1", email: "u@test.local" },
    }).service,
    decks: fake.repository,
  });
  await screen.findByRole("heading", { level: 1 });
  return { fake, router, user: userEvent.setup() };
}

describe("opening a deck in FaBrary", () => {
  it("saves a version before navigating, using the saved snapshot for the link", async () => {
    const { fake, user } = await open();
    const original = fake.repository.saveVersion;
    vi.spyOn(fake.repository, "saveVersion").mockImplementation(async (id) => {
      const version = await original(id);
      return {
        ...version,
        snapshot: {
          ...version.snapshot,
          name: "Saved name",
          cards: version.snapshot.cards.map((card) => ({
            ...card,
            name: "Saved card",
            pitch: 3,
            quantity: 1,
          })),
        },
      };
    });
    const popup = { location: { href: "" }, close: vi.fn(), opener: {} };
    const openWindow = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);
    try {
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      await waitFor(() => expect(fake.saved).toContain("version deck-1"));
      expect(popup.location.href).toContain("https://fabrary.net/decks?");
      const url = new URL(popup.location.href);
      expect(url.searchParams.get("name")).toBe("Saved name");
      expect(url.searchParams.get("cards")).toBe(
        "viserai-the-forsaken,saved-card-blue",
      );
      expect(popup.opener).toBeNull();
      expect(await screen.findByText("Version 1")).toBeInTheDocument();
    } finally {
      openWindow.mockRestore();
    }
  });

  it("keeps the tab blank until saving finishes and prevents a second export while saving", async () => {
    const { fake, user } = await open();
    const original = fake.repository.saveVersion;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const save = vi
      .spyOn(fake.repository, "saveVersion")
      .mockImplementation(async (id) => {
        await gate;
        return original(id);
      });
    const popup = { location: { href: "" }, close: vi.fn(), opener: {} };
    const openWindow = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);
    try {
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      expect(popup.location.href).toBe("");
      expect(
        screen.getByRole("button", { name: "Saving version…" }),
      ).toBeDisabled();
      await user.click(screen.getByRole("button", { name: "Saving version…" }));
      expect(save).toHaveBeenCalledTimes(1);
      finish();
      await waitFor(() =>
        expect(popup.location.href).toContain("https://fabrary.net/"),
      );
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      expect(await screen.findByText("Version 2")).toBeInTheDocument();
    } finally {
      finish();
      openWindow.mockRestore();
    }
  });

  it("closes the blank tab on save failure and lets the player try again", async () => {
    const { fake, user } = await open();
    vi.spyOn(fake.repository, "saveVersion").mockRejectedValueOnce(
      new Error("offline"),
    );
    const popup = { location: { href: "" }, close: vi.fn(), opener: {} };
    const openWindow = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);
    try {
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Couldn't save a version",
      );
      expect(popup.close).toHaveBeenCalledOnce();
      expect(popup.location.href).toBe("");
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      expect(await screen.findByText("Version 1")).toBeInTheDocument();
    } finally {
      openWindow.mockRestore();
    }
  });

  it("does not save a version when the browser blocks the new tab", async () => {
    const { fake, user } = await open();
    const openWindow = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Allow a new tab",
      );
      expect(fake.saved).not.toContain("version deck-1");
    } finally {
      openWindow.mockRestore();
    }
  });

  it("waits for card edits to save before allowing an export", async () => {
    const { fake, user } = await open();
    const original = fake.repository.setCard;
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.spyOn(fake.repository, "setCard").mockImplementation(
      async (id, card) => {
        await gate;
        return original(id, card);
      },
    );
    try {
      await user.click(
        screen.getByRole("button", { name: "One fewer Hocus Pocus (red)" }),
      );
      expect(
        screen.getByRole("button", { name: "Open in FaBrary" }),
      ).toBeDisabled();
      finish();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Open in FaBrary" }),
        ).toBeEnabled(),
      );
    } finally {
      finish();
    }
  });

  it("saves, replaces and clears an optional FaBrary link, rejecting other sites", async () => {
    const { fake, user } = await open();
    const openWindow = vi.spyOn(window, "open").mockReturnValue({
      location: { href: "" },
      close: vi.fn(),
      opener: {},
    } as unknown as Window);
    try {
      await user.click(screen.getByRole("button", { name: "Open in FaBrary" }));
      await user.click(await screen.findByText("Versions (1)"));
      await user.click(screen.getByText("Version 1"));
      const field = screen.getByRole("textbox", {
        name: "FaBrary link for version 1",
      });
      await user.type(field, "https://other.example/decks/1");
      await user.click(screen.getByRole("button", { name: "Save link" }));
      expect(fake.saved).toEqual(["version deck-1"]);
      expect(screen.getByText(/Use a FaBrary deck link/)).toBeInTheDocument();
      await user.clear(field);
      await user.type(field, "https://fabrary.net/decks/first");
      await user.click(screen.getByRole("button", { name: "Save link" }));
      expect(fake.saved).toContain(
        "version link version-1 https://fabrary.net/decks/first",
      );
      await user.clear(field);
      await user.type(field, "https://fabrary.net/decks/second");
      await user.click(screen.getByRole("button", { name: "Save link" }));
      expect(fake.saved).toContain(
        "version link version-1 https://fabrary.net/decks/second",
      );
      await user.clear(field);
      await user.click(screen.getByRole("button", { name: "Save link" }));
      expect(fake.saved).toContain("version link version-1 ");
    } finally {
      openWindow.mockRestore();
    }
  });

  it("links to FaBrary's import form filled in with the hero and every copy", async () => {
    await open("u2", true);
    const link = screen.getByRole("link", { name: "Open in FaBrary" });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(url.searchParams.get("name")).toBe("Gate tempo");
    expect(url.searchParams.get("cards")).toBe(
      "viserai-the-forsaken,hocus-pocus-red,hocus-pocus-red,hocus-pocus-red",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("is there on someone else's public deck too", async () => {
    const { fake } = await open("u2", true);
    expect(
      screen.getByRole("link", { name: "Open in FaBrary" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Versions \(/)).not.toBeInTheDocument();
    expect(fake.saved).toEqual([]);
  });
});

describe("managing a deck from its page", () => {
  it("switches it between private and public", async () => {
    const { fake, user } = await open();
    expect(screen.getByText("Private")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make public" }));
    await waitFor(() => expect(fake.saved).toContain("public deck-1"));
    expect(
      screen.getByRole("button", { name: "Make private" }),
    ).toBeInTheDocument();
  });

  it("renames it, but not to nothing", async () => {
    const { fake, user } = await open();
    await user.click(screen.getByRole("button", { name: "Rename" }));
    const name = screen.getByRole("textbox", { name: "Deck name" });
    expect(name).toHaveValue("Gate tempo");
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save name" }));
    expect(screen.getByText("A deck needs a name.")).toBeInTheDocument();
    await user.type(name, "Gate tempo v2");
    await user.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(fake.saved).toContain("rename deck-1 Gate tempo v2"),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Gate tempo v2" }),
    ).toBeInTheDocument();
  });

  it("deletes it only after you confirm, then goes back to your decks", async () => {
    const { fake, router, user } = await open();
    await user.click(screen.getByRole("button", { name: "Delete deck" }));
    const confirm = within(
      screen.getByRole("dialog", { name: "Delete Gate tempo?" }),
    );
    await user.click(confirm.getByRole("button", { name: "Keep it" }));
    expect(fake.saved).not.toContain("delete deck-1");
    await user.click(screen.getByRole("button", { name: "Delete deck" }));
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Delete Gate tempo?" }),
      ).getByRole("button", { name: "Delete it" }),
    );
    await waitFor(() => expect(fake.saved).toContain("delete deck-1"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/decks"));
  });

  it("shows none of this on someone else's deck", async () => {
    await open("someone-else", true);
    expect(screen.queryByRole("button", { name: /Make p/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete deck" })).toBeNull();
  });
});
