// The explorer's graph, drawn with sigma.js (WebGL) from a graphology graph. Cards that work
// together are pulled into clusters by a ForceAtlas2 layout. Pointing at a card picks out its
// links; clicking one selects it. Tests swap this for a plain list (no WebGL in jsdom).
import Graph from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import type { WeightedEdge } from "../ranking/synergyCore.ts";
import type { ExplorerNode } from "./explorer.ts";
import { ENGINE_COLOURS, KIND_COLOURS } from "./colours.ts";
import styles from "./SynergyExplorerPage.module.css";

const FADED = "#d4d4d880";

export function GraphCanvas(props: {
  nodes: ExplorerNode[];
  edges: WeightedEdge[];
  selected: string | undefined;
  /** Move to the selected card: for the bigger views, where it may be off-screen. */
  follow: boolean;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;

  // Rebuild the graph and its layout when what's shown changes.
  useEffect(() => {
    if (!container.current) return;
    const graph = new Graph({ type: "directed", multi: false });
    for (const n of props.nodes) {
      graph.addNode(n.id, {
        label: n.name,
        color: ENGINE_COLOURS[n.engine ?? "none"],
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

    const fg =
      getComputedStyle(document.documentElement).getPropertyValue("--fg") ||
      "#111";
    const renderer = new Sigma(graph, container.current, {
      defaultEdgeType: "arrow",
      labelColor: { color: fg.trim() },
      labelRenderedSizeThreshold: 7,
      labelDensity: 0.5,
      zIndex: true,
    });
    renderer.on("clickNode", ({ node }) => onSelect.current(node));
    renderer.on("enterNode", ({ node }) => setHovered(node));
    renderer.on("leaveNode", () => setHovered(null));
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
      if (attrs.inCore) out.borderColor = fg();
      if (near && !near.has(id)) {
        out.color = FADED;
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

const fg = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--fg").trim();
