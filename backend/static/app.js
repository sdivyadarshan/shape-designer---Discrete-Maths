const presets = {
    cube: { v: 8, e: 12, category: "House Building" },
    cone: { v: 10, e: 18, category: "Tower Structure" },
    sphere: { v: 12, e: 30, category: "Pavilion Structure" },
    cylinder: { v: 12, e: 18, category: "Bridge Structure" },
    torus: { v: 16, e: 32, category: "Robotics Layout" },
    pyramid: { v: 5, e: 8, category: "Tower Structure" },
    prism: { v: 6, e: 9, category: "Product Design" },
    spiral: { v: 14, e: 18, category: "Robotics Layout" },
    octahedron: { v: 6, e: 12, category: "Space Habitat" },
    dodecahedron: { v: 20, e: 30, category: "Research Facility" },
    hybrid: { v: 13, e: 24, category: "Research Facility" }
};

let lastGraph = null;
let lastAiImageUrl = "";
let rotX = -0.3;
let rotY = 0.5;
const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8001" : "";

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    setupNavigation();
    setupTheme();
    setupPresetSync();
    setupForm();
    setupSave();
    setupAiSave();
    renderStepTrack([]);
    renderEducationDemos();
});

function setupNavigation() {
    document.querySelectorAll(".nav-btn").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            document.getElementById(button.dataset.tab).classList.add("active");
        });
    });
}

function setupTheme() {
    const toggle = document.getElementById("theme-toggle");
    toggle.addEventListener("click", () => {
        document.body.classList.toggle("light-mode");
        toggle.innerHTML = document.body.classList.contains("light-mode")
            ? '<i data-lucide="moon"></i>'
            : '<i data-lucide="sun"></i>';
        lucide.createIcons();
        if (lastGraph) renderGraph(lastGraph);
    });
}

function setupPresetSync() {
    const curve = document.getElementById("curve-type");
    const description = document.getElementById("description");
    const vertices = document.getElementById("vertices");
    const edges = document.getElementById("edges");
    const category = document.getElementById("category");

    function applyPreset(key) {
        const preset = presets[key];
        if (!preset) return;
        vertices.value = preset.v;
        edges.value = preset.e;
        category.value = preset.category;
    }

    curve.addEventListener("change", () => applyPreset(curve.value));
    description.addEventListener("input", () => {
        const key = description.value.trim().toLowerCase().replace(/\s+/g, "-");
        if (presets[key]) {
            curve.value = key;
            applyPreset(key);
        }
    });

    applyPreset(curve.value);
}

function setupForm() {
    const form = document.getElementById("design-form");
    const button = document.getElementById("generate-btn");
    const status = document.getElementById("status-message");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        status.className = "status-box hidden";
        status.textContent = "";
        button.disabled = true;
        button.innerHTML = '<i data-lucide="loader-circle" class="spin"></i> Generating...';
        lucide.createIcons();

        const payload = {
            vertices: numberValue("vertices"),
            edges: numberValue("edges"),
            requireEulerian: document.getElementById("req-eulerian").checked,
            requireHamiltonian: document.getElementById("req-hamiltonian").checked,
            category: document.getElementById("category").value,
            description: document.getElementById("description").value,
            curveType: document.getElementById("curve-type").value,
            enableImage: document.getElementById("enable-image").checked,
            imageStyle: document.getElementById("image-style").value,
            imageQuality: document.getElementById("image-quality").value,
            imagePrompt: document.getElementById("image-prompt").value
        };

        if (payload.enableImage) {
            const container = document.getElementById("render-container");
            container.innerHTML = `
                <div class="ai-placeholder">
                    <div class="shape-preview spin"></div>
                    <strong>Generating AI Render...</strong>
                    <span>Crafting 3D geometry conceptual image.</span>
                </div>
            `;
        }

        try {
            const response = await fetch(`${API_BASE}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            const data = await response.json();
            if (!data.valid) {
                showError(data.reason || "Design is mathematically invalid.");
                renderInvalidState(data.reason);
                return;
            }
            // Reset angles for a brand new generation
            rotX = -0.3;
            rotY = 0.5;
            
            lastGraph = data;
            renderGraph(data);
            renderMetrics(data.properties);
            renderReport(data);
            renderImage(data);
            document.getElementById("save-jpg-btn").disabled = false;
            if (data.image && !data.image.ok) {
                showInfo(`Graph generated. AI renderer warning: ${data.image.error}`);
            }
        } catch (error) {
            showError("Backend not reachable. Keep this server running, then reload: http://127.0.0.1:8001");
        } finally {
            button.disabled = false;
            button.innerHTML = '<i data-lucide="sparkles"></i> Generate Strong Design';
            lucide.createIcons();
        }
    });
}

function numberValue(id) {
    return Number.parseInt(document.getElementById(id).value, 10) || 0;
}

function showError(message) {
    const status = document.getElementById("status-message");
    status.className = "status-box error";
    status.textContent = message;
}

function showInfo(message) {
    const status = document.getElementById("status-message");
    status.className = "status-box";
    status.textContent = message;
}

function renderInvalidState(reason) {
    document.getElementById("graph-container").innerHTML = `
        <div class="empty-state">
            <i data-lucide="circle-alert"></i>
            <strong>Invalid graph</strong>
            <span>${escapeHtml(reason || "Change constraints and try again.")}</span>
        </div>
    `;
    lucide.createIcons();
}

function renderGraph(data) {
    const container = document.getElementById("graph-container");
    const rect = container.getBoundingClientRect();
    const width = Math.max(rect.width, 420);
    const height = 440;
    const nodes = data.nodes;
    const links = data.links;
    const hamiltonianEdges = new Set(pathEdges(data.paths?.hamiltonian || []));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    const isLightMode = document.body.classList.contains("light-mode");

    container.innerHTML = "";
    const svg = d3.select(container).append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "Generated graph visualization")
        .style("cursor", "grab");

    const defs = svg.append("defs");
    const gradient = defs.append("radialGradient").attr("id", "nodeGradient").attr("cx", "35%").attr("cy", "25%");
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#9ec4ff");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#4b46ff");

    // Add drag behavior for background rotation
    svg.call(d3.drag()
        .on("drag", (event) => {
            if (event.sourceEvent.target.tagName === "circle" || event.sourceEvent.target.tagName === "text") return;
            rotY += event.dx * 0.01;
            rotX += event.dy * 0.01;
            updatePositions();
        })
    );

    const linkElements = svg.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", (link) => `graph-link ${hamiltonianEdges.has(edgeKey(link.source, link.target)) ? "highlight" : ""}`)
        // Set inline attributes for SVG export compatibility
        .attr("stroke", (link) => hamiltonianEdges.has(edgeKey(link.source, link.target)) ? "#ff3344" : (isLightMode ? "rgba(25, 39, 75, 0.45)" : "rgba(231, 239, 255, 0.76)"))
        .attr("stroke-width", (link) => hamiltonianEdges.has(edgeKey(link.source, link.target)) ? 3.2 : 2.2);

    // Node drag behavior
    const dragNode = d3.drag()
        .on("start", (event, d) => {
            svg.style("cursor", "grabbing");
        })
        .on("drag", (event, d) => {
            const scale = Math.min(width, height) * 0.85;
            const dx = event.dx / scale;
            const dy = -event.dy / scale;

            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

            const dy_rot = dy * cosX;
            const dz_rot = -dy * sinX;

            const dx_final = dx * cosY + dz_rot * sinY;
            const dz_final = -dx * sinY + dz_rot * cosY;

            d.x += dx_final;
            d.y += dy_rot;
            d.z += dz_final;

            updatePositions();
        })
        .on("end", (event, d) => {
            svg.style("cursor", "grab");
        });

    const nodeElements = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .style("cursor", "pointer")
        .call(dragNode);

    nodeElements.append("circle")
        .attr("class", "graph-node")
        .attr("r", 16)
        // Inline attributes for canvas export
        .attr("fill", "url(#nodeGradient)")
        .attr("stroke", isLightMode ? "#243cff" : "#cfd8ff")
        .attr("stroke-width", 1.7);

    nodeElements.append("text")
        .attr("class", "graph-label")
        .text((item) => item.label)
        // Inline attributes for canvas export
        .attr("fill", "#ffffff")
        .attr("font-size", "12px")
        .attr("font-weight", "900")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle");

    function updatePositions() {
        const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
        const scale = Math.min(width, height) * 0.85;
        const cx = width / 2;
        const cy = height / 2;

        nodes.forEach(node => {
            const x_val = Number(node.x) || 0;
            const y_val = Number(node.y) || 0;
            const z_val = Number(node.z) || 0;

            const x1 = x_val * cosY - z_val * sinY;
            const z1 = x_val * sinY + z_val * cosY;

            const y2 = y_val * cosX - z1 * sinX;

            node.px = cx + x1 * scale;
            node.py = cy - y2 * scale;
        });

        linkElements
            .attr("x1", (d) => nodeById.get(String(d.source)).px)
            .attr("y1", (d) => nodeById.get(String(d.source)).py)
            .attr("x2", (d) => nodeById.get(String(d.target)).px)
            .attr("y2", (d) => nodeById.get(String(d.target)).py);

        nodeElements
            .attr("transform", (d) => `translate(${d.px}, ${d.py})`);
    }

    // Run initial positioning
    updatePositions();
}

function edgeKey(a, b) {
    return [String(a), String(b)].sort().join("--");
}

function pathEdges(path) {
    const edges = [];
    for (let index = 0; index < path.length - 1; index += 1) {
        edges.push(edgeKey(path[index], path[index + 1]));
    }
    return edges;
}

function renderMetrics(properties) {
    document.getElementById("metric-v").textContent = properties.vertices;
    document.getElementById("metric-e").textContent = properties.edges;
    document.getElementById("metric-connected").textContent = yesNo(properties.is_connected);
    document.getElementById("metric-eulerian").textContent = yesNo(properties.is_eulerian);
    document.getElementById("metric-hamiltonian").textContent = yesNo(properties.is_hamiltonian);
}

function yesNo(value) {
    return value ? "Yes" : "No";
}

function renderReport(data) {
    const adjacency = Object.entries(data.adjacency)
        .map(([node, neighbors]) => `${node}: [${neighbors.join(", ")}]`)
        .join("\n");
    document.getElementById("adjacency-list").textContent = adjacency;

    const hPath = data.paths?.hamiltonian?.length ? data.paths.hamiltonian.join(" -> ") : "No Hamiltonian cycle found";
    const ePath = data.paths?.eulerian?.length ? data.paths.eulerian.join(" -> ") : "No Eulerian circuit found";
    document.getElementById("path-summary").innerHTML = `
        <strong>Hamiltonian:</strong> ${escapeHtml(hPath)}<br>
        <strong>Eulerian:</strong> ${escapeHtml(ePath)}<br>
        <strong>Density:</strong> ${data.properties.density}, degree range ${data.properties.min_degree}-${data.properties.max_degree}.
    `;

    const result = document.getElementById("overall-result");
    const good = data.properties.is_connected && (data.properties.is_hamiltonian || data.properties.is_eulerian);
    result.className = `result-badge ${good ? "good" : "bad"}`;
    result.textContent = good ? "Feasible" : "Needs Work";

    document.getElementById("shape-title").textContent = `${data.shape.label} - ${data.shape.category}`;
    document.getElementById("design-interpretation").textContent = data.shape.summary;
    renderStepTrack(data.nodes.slice(0, 6));
}

function renderImage(data) {
    const container = document.getElementById("render-container");
    const saveButton = document.getElementById("save-ai-btn");
    lastAiImageUrl = "";
    saveButton.disabled = true;

    if (data.image?.ok && data.image.url) {
        lastAiImageUrl = data.image.url;
        
        const img = new Image();
        img.className = "render-image";
        img.alt = "AI generated shape design";
        
        img.onload = () => {
            container.innerHTML = "";
            container.appendChild(img);
            saveButton.disabled = false;
        };
        
        img.onerror = () => {
            container.innerHTML = `
                <div class="ai-placeholder">
                    <div class="shape-preview"></div>
                    <strong>Image load failed</strong>
                    <span>Unable to load the generated concept image.</span>
                </div>
            `;
        };
        
        img.src = data.image.url;
        return;
    }

    const message = data.image?.error
        ? `AI renderer did not return an image: ${escapeHtml(data.image.error)}`
        : "AI render disabled. Graph-based preview is shown.";
    container.innerHTML = `
        <div class="ai-placeholder">
            <div class="shape-preview"></div>
            <strong>${escapeHtml(data.shape.label)} AI render preview</strong>
            <span>${message}</span>
        </div>
    `;
}

function setupAiSave() {
    document.getElementById("save-ai-btn").addEventListener("click", async () => {
        if (!lastAiImageUrl) return;
        try {
            const response = await fetch(lastAiImageUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.download = `dalle-3-shape-design-${Date.now()}.png`;
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            window.open(lastAiImageUrl, "_blank", "noopener,noreferrer");
        }
    });
}

function renderStepTrack(nodes) {
    const track = document.getElementById("step-track");
    const steps = nodes.length ? nodes : Array.from({ length: 6 }, (_, index) => ({ label: index + 1 }));
    track.innerHTML = steps.slice(0, 6).map((node, index) => `
        <div class="step-card">
            <svg viewBox="0 0 120 48" aria-hidden="true">
                <line x1="20" y1="26" x2="${58 + index * 7}" y2="${18 + (index % 2) * 16}" stroke="#5d72ff" stroke-width="2"/>
                <circle cx="20" cy="26" r="4" fill="#5d72ff"/>
                <circle cx="${58 + index * 7}" cy="${18 + (index % 2) * 16}" r="4" fill="#8b3dff"/>
            </svg>
            <span>Step ${index + 1}${node.label ? ` - node ${node.label}` : ""}</span>
        </div>
    `).join("");
}

function setupSave() {
    document.getElementById("save-jpg-btn").addEventListener("click", () => {
        const svg = document.querySelector("#graph-container svg");
        if (!svg) return;
        const serializer = new XMLSerializer();
        const svgText = serializer.serializeToString(svg);
        const image = new Image();
        const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = 1200;
            canvas.height = 800;
            const context = canvas.getContext("2d");
            context.fillStyle = document.body.classList.contains("light-mode") ? "#f4f7fb" : "#070b16";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            const link = document.createElement("a");
            link.download = `shape-design-${Date.now()}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.94);
            link.click();
        };
        image.src = url;
    });
}

function renderEducationDemos() {
    drawMiniGraph(".hamiltonian-demo", true);
    drawMiniGraph(".eulerian-demo", false);
}

function drawMiniGraph(selector, hamiltonian) {
    const container = document.querySelector(selector);
    if (!container) return;
    const width = container.clientWidth || 460;
    const height = 240;
    const points = Array.from({ length: hamiltonian ? 8 : 6 }, (_, index) => {
        const angle = Math.PI * 2 * index / (hamiltonian ? 8 : 6) - Math.PI / 2;
        return { x: width / 2 + Math.cos(angle) * 110, y: height / 2 + Math.sin(angle) * 82, label: index + 1 };
    });
    const svg = d3.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const pairs = points.map((_, index) => [index, (index + 1) % points.length]);
    pairs.push([0, 3], [1, 4], [2, 5]);
    svg.selectAll("line").data(pairs).join("line")
        .attr("x1", (edge) => points[edge[0]].x)
        .attr("y1", (edge) => points[edge[0]].y)
        .attr("x2", (edge) => points[edge[1]].x)
        .attr("y2", (edge) => points[edge[1]].y)
        .attr("stroke", (edge, index) => index < points.length ? "#ff3344" : "rgba(238,244,255,0.45)")
        .attr("stroke-width", (edge, index) => index < points.length ? 3 : 1.5);
    svg.selectAll("circle").data(points).join("circle")
        .attr("cx", (point) => point.x)
        .attr("cy", (point) => point.y)
        .attr("r", 15)
        .attr("fill", "#dbe7ff")
        .attr("stroke", "#243cff");
    svg.selectAll("text").data(points).join("text")
        .attr("x", (point) => point.x)
        .attr("y", (point) => point.y + 4)
        .attr("text-anchor", "middle")
        .attr("font-size", 12)
        .attr("font-weight", 900)
        .text((point) => point.label);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
