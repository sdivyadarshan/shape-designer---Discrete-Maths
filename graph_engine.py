import math
import random

import networkx as nx


SHAPE_PRESETS = {
    "cube": {"vertices": 8, "edges": 12, "category": "House Building"},
    "tetrahedron": {"vertices": 4, "edges": 6, "category": "Product Design"},
    "octahedron": {"vertices": 6, "edges": 12, "category": "Space Habitat"},
    "dodecahedron": {"vertices": 20, "edges": 30, "category": "Research Facility"},
    "icosahedron": {"vertices": 12, "edges": 30, "category": "Space Habitat"},
    "sphere": {"vertices": 12, "edges": 30, "category": "Pavilion Structure"},
    "cone": {"vertices": 10, "edges": 18, "category": "Tower Structure"},
    "cylinder": {"vertices": 12, "edges": 18, "category": "Bridge Structure"},
    "torus": {"vertices": 16, "edges": 32, "category": "Robotics Layout"},
    "pyramid": {"vertices": 5, "edges": 8, "category": "Monument Design"},
    "prism": {"vertices": 6, "edges": 9, "category": "Product Design"},
    "spiral": {"vertices": 14, "edges": 18, "category": "Robotics Layout"},
    "hybrid": {"vertices": 13, "edges": 24, "category": "Research Facility"},
}


def generate_design(
    v: int,
    e: int,
    req_eulerian: bool,
    req_hamiltonian: bool,
    description: str = "",
    curve_type: str = "cube",
    category: str = "House Building",
):
    shape_key = _clean_shape(description) or _clean_shape(curve_type) or "custom"
    preset = SHAPE_PRESETS.get(shape_key)

    if preset:
        v = preset["vertices"]
        e = preset["edges"]
        category = category or preset["category"]

    if v <= 0:
        return {"valid": False, "reason": "Number of vertices must be greater than 0."}

    max_edges = v * (v - 1) // 2
    if e > max_edges:
        return {
            "valid": False,
            "reason": f"Too many edges. A simple graph with {v} vertices can have at most {max_edges} edges.",
        }

    if (req_eulerian or req_hamiltonian) and e < v and v > 2:
        return {
            "valid": False,
            "reason": f"A graph with {v} vertices requires at least {v} edges to form a closed Eulerian or Hamiltonian design.",
        }

    G = _preset_graph(shape_key) if preset else _custom_graph(v, e, req_eulerian, req_hamiltonian)

    if G.number_of_edges() > e and not preset:
        return {
            "valid": False,
            "reason": f"Your constraints imply at least {G.number_of_edges()} edges, but you provided {e}.",
        }

    if not preset:
        _add_remaining_edges(G, e - G.number_of_edges())

    is_connected = nx.is_connected(G) if G.number_of_nodes() > 0 else True
    is_eulerian = nx.is_eulerian(G) if is_connected else False
    hamiltonian_path = _find_hamiltonian_cycle(G)
    is_hamiltonian = bool(hamiltonian_path)

    if req_eulerian and not is_eulerian:
        odd_nodes = [node for node, degree in G.degree() if degree % 2 != 0]
        return {
            "valid": False,
            "reason": f"Eulerian circuit failed. All vertices need even degree; {len(odd_nodes)} vertices are odd.",
        }

    if req_hamiltonian and not is_hamiltonian:
        return {
            "valid": False,
            "reason": "Hamiltonian cycle failed. The graph does not visit every vertex exactly once and return home.",
        }

    positions = _shape_positions(G, shape_key)
    nodes = [
        {
            "id": str(node),
            "label": str(index + 1),
            "x": round(float(positions[node][0]), 4),
            "y": round(float(positions[node][1]), 4),
            "z": round(float(positions[node][2]), 4) if len(positions[node]) > 2 else 0.0,
            "degree": int(G.degree(node)),
        }
        for index, node in enumerate(G.nodes())
    ]
    links = [{"source": str(u), "target": str(w)} for u, w in G.edges()]
    adjacency = {
        str(node): [str(neighbor) for neighbor in sorted(G.neighbors(node), key=lambda item: str(item))]
        for node in G.nodes()
    }

    euler_path = []
    if is_eulerian:
        try:
            euler_path = [str(edge[0]) for edge in nx.eulerian_circuit(G)]
            if euler_path:
                euler_path.append(euler_path[0])
        except Exception:
            euler_path = []

    density = 0 if max_edges == 0 else round(G.number_of_edges() / max_edges, 2)
    return {
        "valid": True,
        "nodes": nodes,
        "links": links,
        "adjacency": adjacency,
        "paths": {
            "eulerian": euler_path,
            "hamiltonian": [str(node) for node in hamiltonian_path],
        },
        "properties": {
            "is_connected": is_connected,
            "is_eulerian": is_eulerian,
            "is_hamiltonian": is_hamiltonian,
            "vertices": G.number_of_nodes(),
            "edges": G.number_of_edges(),
            "density": density,
            "min_degree": min(dict(G.degree()).values()) if G.number_of_nodes() else 0,
            "max_degree": max(dict(G.degree()).values()) if G.number_of_nodes() else 0,
        },
        "shape": {
            "type": shape_key,
            "label": _label(shape_key),
            "category": category,
            "summary": _shape_summary(shape_key, category),
        },
    }


def _clean_shape(value: str):
    key = (value or "").strip().lower().replace(" ", "-")
    aliases = {
        "round": "sphere",
        "ball": "sphere",
        "tube": "cylinder",
        "donut": "torus",
        "triangular-prism": "prism",
        "helix": "spiral",
    }
    return aliases.get(key, key if key in SHAPE_PRESETS else "")


def _preset_graph(shape_key: str):
    if shape_key == "cube":
        return nx.convert_node_labels_to_integers(nx.hypercube_graph(3), first_label=1)
    if shape_key == "tetrahedron":
        return nx.tetrahedral_graph()
    if shape_key == "octahedron":
        return nx.octahedral_graph()
    if shape_key == "dodecahedron":
        return nx.dodecahedral_graph()
    if shape_key in ("icosahedron", "sphere"):
        return nx.icosahedral_graph()
    if shape_key == "cone":
        return nx.wheel_graph(10)
    if shape_key == "cylinder":
        return nx.circular_ladder_graph(6)
    if shape_key == "torus":
        return nx.convert_node_labels_to_integers(nx.grid_2d_graph(4, 4, periodic=True), first_label=1)
    if shape_key == "pyramid":
        G = nx.cycle_graph(4)
        G.add_node(4)
        G.add_edges_from((4, i) for i in range(4))
        return G
    if shape_key == "prism":
        return nx.triangular_prism_graph()
    if shape_key == "spiral":
        G = nx.path_graph(14)
        G.add_edges_from([(0, 4), (2, 7), (5, 10), (9, 13), (1, 12)])
        return G
    if shape_key == "hybrid":
        # A cylinder of 6 nodes on bottom, cap of 6 nodes on top connected as a wheel/cone
        # Total 13 nodes (1 to 13)
        G = nx.Graph()
        # Bottom ring: 1-6
        for i in range(1, 7):
            G.add_edge(i, (i % 6) + 1)
        # Top ring: 7-12
        for i in range(7, 13):
            next_node = 7 + (i - 7 + 1) % 6
            G.add_edge(i, next_node)
        # Connect bottom to top (i to i+6)
        for i in range(1, 7):
            G.add_edge(i, i + 6)
        # Connect top ring to cap node 13
        for i in range(7, 13):
            G.add_edge(13, i)
        return G
    return nx.Graph()


def _custom_graph(v: int, e: int, req_eulerian: bool, req_hamiltonian: bool):
    G = nx.Graph()
    G.add_nodes_from(range(1, v + 1))

    if req_eulerian or req_hamiltonian:
        G.add_edges_from((node, node + 1) for node in range(1, v))
        G.add_edge(v, 1)
    elif e >= v - 1:
        G.add_edges_from((node, node + 1) for node in range(1, v))

    return G


def _add_remaining_edges(G, count: int):
    if count <= 0:
        return
    possible_edges = list(nx.non_edges(G))
    random.Random(42).shuffle(possible_edges)
    G.add_edges_from(possible_edges[:count])


def _find_hamiltonian_cycle(G):
    nodes = list(G.nodes())
    if len(nodes) < 3:
        return []

    start = nodes[0]

    def backtrack(path, visited):
        if len(path) == len(nodes):
            return path + [start] if G.has_edge(path[-1], start) else []
        for neighbor in sorted(G.neighbors(path[-1]), key=lambda item: str(item)):
            if neighbor not in visited:
                result = backtrack(path + [neighbor], visited | {neighbor})
                if result:
                    return result
        return []

    return backtrack([start], {start})


def _shape_positions(G, shape_key: str):
    nodes = list(G.nodes())
    count = max(len(nodes), 1)

    if shape_key == "cube":
        coords = [
            (-0.35, -0.35, -0.35), (0.35, -0.35, -0.35), (0.35, 0.35, -0.35), (-0.35, 0.35, -0.35),
            (-0.35, -0.35, 0.35), (0.35, -0.35, 0.35), (0.35, 0.35, 0.35), (-0.35, 0.35, 0.35)
        ]
        return {nodes[i]: coords[i % 8] for i in range(count)}

    if shape_key == "tetrahedron":
        coords = [
            (0.35, 0.35, 0.35), (-0.35, -0.35, 0.35), (-0.35, 0.35, -0.35), (0.35, -0.35, -0.35)
        ]
        return {nodes[i]: coords[i % 4] for i in range(count)}

    if shape_key == "octahedron":
        coords = [
            (0, 0, 0.5), (0, 0, -0.5), (0.5, 0, 0), (-0.5, 0, 0), (0, 0.5, 0), (0, -0.5, 0)
        ]
        return {nodes[i]: coords[i % 6] for i in range(count)}

    if shape_key in ("cone", "pyramid"):
        positions = {}
        positions[nodes[0]] = (0.0, 0.0, 0.4)
        ring_nodes = nodes[1:]
        for index, node in enumerate(ring_nodes):
            angle = math.tau * index / max(len(ring_nodes), 1)
            positions[node] = (0.35 * math.cos(angle), 0.35 * math.sin(angle), -0.3)
        return positions

    if shape_key == "cylinder":
        positions = {}
        half = count // 2
        for index, node in enumerate(nodes):
            ring = 0 if index < half else 1
            local = index if ring == 0 else index - half
            angle = math.tau * local / max(half, 1)
            x = 0.35 * math.cos(angle)
            y = 0.35 * math.sin(angle)
            z = -0.3 if ring == 0 else 0.3
            positions[node] = (x, y, z)
        return positions

    if shape_key == "spiral":
        positions = {}
        for index, node in enumerate(nodes):
            radius = 0.1 + 0.3 * index / max(count - 1, 1)
            angle = index * 0.82
            z = -0.35 + 0.7 * index / max(count - 1, 1)
            positions[node] = (radius * math.cos(angle), radius * math.sin(angle), z)
        return positions

    if shape_key == "torus":
        positions = {}
        for index, node in enumerate(nodes):
            angle = math.tau * index / count
            wobble = 0.06 * math.sin(angle * 4)
            positions[node] = ((0.32 + wobble) * math.cos(angle), (0.32 + wobble) * math.sin(angle), 0.12 * math.cos(angle * 4))
        return positions

    if shape_key in ("sphere", "icosahedron", "dodecahedron"):
        positions = {}
        for index, node in enumerate(nodes):
            phi = math.acos(1 - 2 * (index + 0.5) / count)
            theta = math.pi * (1 + 5**0.5) * index
            x = 0.35 * math.sin(phi) * math.cos(theta)
            y = 0.35 * math.sin(phi) * math.sin(theta)
            z = 0.35 * math.cos(phi)
            positions[node] = (x, y, z)
        return positions

    if shape_key == "prism":
        positions = {}
        for index, node in enumerate(nodes):
            ring = 0 if index < 3 else 1
            local = index % 3
            angle = math.tau * local / 3
            positions[node] = (0.35 * math.cos(angle), 0.35 * math.sin(angle), -0.3 if ring == 0 else 0.3)
        return positions

    if shape_key == "hybrid":
        positions = {}
        for index in range(6):
            angle = math.tau * index / 6
            positions[nodes[index]] = (0.35 * math.cos(angle), 0.35 * math.sin(angle), -0.35)
        for index in range(6):
            angle = math.tau * index / 6
            positions[nodes[index + 6]] = (0.35 * math.cos(angle), 0.35 * math.sin(angle), 0.1)
        positions[nodes[12]] = (0.0, 0.0, 0.45)
        return positions

    try:
        layout = nx.spring_layout(G, dim=3, seed=42)
        return {node: (float(layout[node][0] * 0.45), float(layout[node][1] * 0.45), float(layout[node][2] * 0.45)) for node in nodes}
    except Exception:
        return {
            node: (
                0.35 * math.cos(math.tau * index / count),
                0.35 * math.sin(math.tau * index / count),
                0.0
            )
            for index, node in enumerate(nodes)
        }


def _label(shape_key: str):
    return shape_key.replace("-", " ").title() if shape_key else "Custom"


def _shape_summary(shape_key: str, category: str):
    label = _label(shape_key)
    return (
        f"{label} mapped to {category}: vertices represent structural control points, "
        "edges represent circulation, support, or drawing strokes, and the graph checks validate feasibility."
    )
