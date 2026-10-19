// The explorer's graph, drawn with sigma.js (WebGL) from a graphology graph. Cards that work
// together are pulled into clusters by a ForceAtlas2 layout. Pointing at a card picks out its
// links; clicking one selects it. Tests swap this for a plain list (no WebGL in jsdom).
import { createNodeBorderProgram } from "@sigma/node-border";
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import type { WeightedEdge } from "../ranking/synergyCore.ts";
import type { ExplorerNode } from "./explorer.ts";
import { KIND_COLOURS } from "./colours.ts";
import { nodeStyle } from "./nodeStyle.ts";
import styles from "./SynergyExplorerPage.module.css";

const FADED = "#d4d4d880";

/** A ring around a filled centre: the ring and centre colours come from nodeStyle. */
const RingProgram = createNodeBorderProgram({
  borders: [
    {
      size: { attribute: "ringSize", defaultValue: 0.3 },
      color: { attribute: "ringColor" },
    },
    { size: { fill: true }, color: { attribute: "color" } },
  ],
});

/** The page's colours, read when the graph is drawn (WebGL can't use CSS variables). */
const themeColour = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
  fallback;

export function GraphCanvas(props: {
  nodes: ExplorerNode[];
  edges: WeightedEdge[];
  selected: string | undefined;
  /** Move to the selected card: for the bigger views, where it may be off-screen. */
  follow: boolean;
  onSelect: (id: string) => void;
  /** The card being pointed at, or null when the pointer leaves it. */
  onHover: (id: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;
  const onHover = useRef(props.onHover);
  onHover.current = props.onHover;

  // Rebuild the graph and its layout when what's shown changes.
  useEffect(() => {
    if (!container.current) return;
    const graph = new Graph({ type: "directed", multi: false });
    const theme = {
      surface: themeColour("--surface", "#ffffff"),
      fg: themeColour("--fg", "#111111"),
    };
    for (const n of props.nodes) {
      graph.addNode(n.id, {
        label: n.name,
        ...nodeStyle(n, theme),
        inCore: n.inCore,
        selected: n.selected,
        size: 4,
      });
    }
    for (const e of props.edges) {
      if (!graph.hasNode(e.from) || !graph.hasNode(e.to)) continue;
      graph.addDirectedEdge(e.from, e.to, {
        color: KIND_COLOURS[e.kind],
        size: 0.5 + e.weight * 2.5,
        type: "arrow",
      });
    }
    // Busier cards are drawn larger.
    graph.forEachNode((id, attrs) =>
      graph.setNodeAttribute(
        id,
        "size",
        (attrs.selected ? 10 : 3) + Math.sqrt(graph.degree(id)) * 1.5,
      ),
    );
    if (graph.order > 0) {
      circular.assign(graph);
      forceAtlas2.assign(graph, {
        iterations: graph.order > 300 ? 150 : 300,
        settings: {
          ...forceAtlas2.inferSettings(graph),
          gravity: 1,
          barnesHutOptimize: graph.order > 300,
        },
      });
    }

    const renderer = new Sigma(graph, container.current, {
      defaultEdgeType: "arrow",
      defaultNodeType: "ring",
      nodeProgramClasses: { ring: RingProgram },
      labelColor: { color: theme.fg },
      labelRenderedSizeThreshold: 7,
      labelDensity: 0.5,
      zIndex: true,
    });
    renderer.on("clickNode", ({ node }) => onSelect.current(node));
    renderer.on("enterNode", ({ node }) => {
      setHovered(node);
      onHover.current(node);
    });
    renderer.on("leaveNode", () => {
      setHovered(null);
      onHover.current(null);
    });
    // Draw once now, so positions are known before the camera moves to the selected card.
    renderer.refresh();
    sigma.current = renderer;
    return () => {
      renderer.kill();
      sigma.current = null;
    };
  }, [props.nodes, props.edges]);

  // Picking out a card's links: the hovered card, or else the selected one.
  useEffect(() => {
    const renderer = sigma.current;
    if (!renderer) return;
    const graph = renderer.getGraph();
    const focus = hovered ?? props.selected;
    const near =
      focus && graph.hasNode(focus)
        ? new Set([focus, ...graph.neighbors(focus)])
        : null;
    renderer.setSetting("nodeReducer", (id, attrs) => {
      const out = { ...attrs };
      if (near && !near.has(id)) {
        out.color = FADED;
        out.ringColor = FADED;
        out.label = "";
      }
      if (near?.has(id)) out.forceLabel = true;
      if (id === focus) out.highlighted = true;
      return out;
    });
    renderer.setSetting("edgeReducer", (id, attrs) => {
      if (!near) return attrs;
      const [from, to] = graph.extremities(id);
      return from === focus || to === focus
        ? { ...attrs, zIndex: 1 }
        : { ...attrs, hidden: true };
    });
  }, [hovered, props.selected, props.nodes]);

  // Move to the selected card.
  useEffect(() => {
    const renderer = sigma.current;
    if (!renderer || !props.selected || !props.follow) return;
    const at = renderer.getNodeDisplayData(props.selected);
    if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
    // The camera works in sigma's framed coordinates, not the layout's.
    const framed = renderer.viewportToFramedGraph(
      renderer.graphToViewport({ x: at.x, y: at.y }),
    );
    void renderer
      .getCamera()
      .animate({ ...framed, ratio: 1 }, { duration: 400 });
  }, [props.selected, props.nodes, props.follow]);

  return (
    <div
      ref={container}
      className={styles.canvas}
      role="img"
      aria-label={`Synergy graph: ${props.nodes.length} cards, ${props.edges.length} links. The panel lists the selected card's links.`}
    />
  );
}
