# Deck versions

Opening your deck in FaBrary first saves a version. Each successful opening saves a new
numbered version, even when the list has not changed. A failed save keeps you here and
offers another try. Saving records the export attempt; it cannot confirm that you pressed
Import in FaBrary, or that you later kept the same list there.

Versions have their own **Versions** tab on the deck page, shown only to the owner. After
a save, a short note under the deck header links to it.

## What is saved

The server takes a copy of the saved deck in one database statement. It includes:

- The deck name, hero (Viserai, the Forsaken), format and pitch targets.
- Every main deck and sideboard row, including weapons and equipment, with its quantity
  and sideboard flag. A card split between the two keeps both rows.
- Each card's variant id, external id, name, pitch, type and subtypes at export time.
- Every loadout, including the default, hero-specific and custom named sideboard plans: name, default flag, opposing
  hero id and name where present, and card quantities. A custom plan needs no hero.

The FaBrary link is built from that saved copy. It sends the hero and the whole pool,
as the existing import link does. FaBrary does not receive the split or the loadouts.
Those stay in the version for later use. Versions record the saved state; unsaved
changes must finish before exporting. Changes to the live deck, loadouts or card data
do not change an earlier version. This is a list snapshot, not a copy of card rules.

## Ownership and deletion

Versions are private to the deck's owner, even when the deck is public. Only the owner
can create a version, read it or change its optional FaBrary link. The saved list,
number and date cannot be edited. Other players can still open a public deck in FaBrary,
but that does not add a version to its owner's history.

Deleting a deck deletes its versions too. Deleting the owner's account deletes their
decks and versions. There is no separate version deletion in this first step.

## FaBrary link

FaBrary's import form returns no deck id. After importing, the player can paste the
resulting `https://fabrary.net/decks/<id>` link onto a version, or leave it blank.
The link can be replaced or cleared. It is a reference supplied by the player;
we do not claim to have checked that the lists match.

## Comparing versions

Once there is a version, the Versions tab can compare one version with another, or
with the deck as it is now (the default: the newest version against the current deck).
It lists the cards added, removed and changed in quantity, as `Hocus Pocus (red) 2 → 3`,
with the main deck and the sideboard apart: a copy moved across shows on both sides.
Each line says Added, Removed or Changed in words. Loadouts and pitch targets are not
compared yet.

A deck's strategy comes later.
