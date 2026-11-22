
const svg = document.getElementById("table");
const ballsLayer = document.getElementById("ballsLayer");
const aimLayer = document.getElementById("aimLayer");
const trajectoryLayer = document.getElementById("trajectoryLayer");

const R = 13;
const DIAMETER = R * 2;

let balls = [
    { id: "white", x: 300, y: 275, color: "#ffffff" },
    { id: "target", x: 610, y: 275, color: "#e83e42" },
    { id: "yellow", x: 760, y: 180, color: "#f2d044" },
    { id: "black", x: 760, y: 370, color: "#171717" }
];

// Direction du point de contact, indépendante des billes.
let aimAngle = Math.PI;

let activeDrag = null;
let effect = "centre";
let spinX = 0;
let spinY = 0;
let showTrajectories = true;

const $ = id => document.getElementById(id);

function getBall(id) {
    return balls.find(ball => ball.id === id);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalize(x, y) {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
}

function pointFromEvent(event) {
    const rect = svg.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * 1000 / rect.width,
        y: (event.clientY - rect.top) * 550 / rect.height
    };
}

function createSvg(tag, attributes = {}) {
    const element = document.createElementNS(
        "http://www.w3.org/2000/svg",
        tag
    );

    for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
    }

    return element;
}

function addLine(parent, x1, y1, x2, y2, color, width = 3, dash = "") {
    const line = createSvg("line", {
        x1, y1, x2, y2,
        stroke: color,
        "stroke-width": width,
        "stroke-linecap": "round"
    });

    if (dash) line.setAttribute("stroke-dasharray", dash);

    parent.appendChild(line);
}

function addCircle(parent, x, y, radius, fill, stroke = "none", width = 1) {
    parent.appendChild(createSvg("circle", {
        cx: x,
        cy: y,
        r: radius,
        fill,
        stroke,
        "stroke-width": width
    }));
}

function drawBalls() {
    ballsLayer.innerHTML = "";

    balls.forEach(ball => {
        const group = createSvg("g", {
            class: "ball",
            "data-id": ball.id
        });

        addCircle(group, ball.x + 2, ball.y + 4, R + 1, "#00000066");

        addCircle(
            group,
            ball.x,
            ball.y,
            R,
            ball.color,
            ball.id === "white" ? "#cbd5df" : "#111",
            1.5
        );

        addCircle(
            group,
            ball.x - 4,
            ball.y - 5,
            3,
            "#ffffff99"
        );

        ballsLayer.appendChild(group);

        group.addEventListener("pointerdown", event => {
            event.stopPropagation();
            activeDrag = { type: "ball", id: ball.id };
            group.setPointerCapture(event.pointerId);
        });

        group.addEventListener("pointermove", event => {
            if (!activeDrag ||
                activeDrag.type !== "ball" ||
                activeDrag.id !== ball.id) return;

            moveBall(ball, event);
        });

        group.addEventListener("pointerup", () => {
            if (activeDrag?.id === ball.id) {
                activeDrag = null;
            }
        });

        group.addEventListener("pointercancel", () => {
            activeDrag = null;
        });
    });
}

function moveBall(ball, event) {
    const point = pointFromEvent(event);

    ball.x = clamp(point.x, 70, 930);
    ball.y = clamp(point.y, 70, 480);

    draw();
}

function getGeometry() {
    const cue = getBall("white");
    const target = getBall("target");

    const normal = {
        x: Math.cos(aimAngle),
        y: Math.sin(aimAngle)
    };

    // Centre théorique de la blanche au moment du contact.
    const ghost = {
        x: target.x + normal.x * DIAMETER,
        y: target.y + normal.y * DIAMETER
    };

    // Point de contact sur la surface de la bille cible.
    const contact = {
        x: target.x + normal.x * R,
        y: target.y + normal.y * R
    };

    const incoming = normalize(
        ghost.x - cue.x,
        ghost.y - cue.y
    );

    const distanceToLine = Math.abs(
        (target.x - cue.x) * incoming.y -
        (target.y - cue.y) * incoming.x
    );

    const overlap = clamp(
        (DIAMETER - distanceToLine) / DIAMETER,
        0,
        1
    );

    return {
        cue,
        target,
        normal,
        ghost,
        contact,
        incoming,
        overlap,
        distanceToLine
    };
}

function contactName(overlap) {
    if (overlap >= 0.875) return "Pleine bille";
    if (overlap >= 0.625) return "3/4 bille";
    if (overlap >= 0.375) return "Demi-bille";
    if (overlap >= 0.125) return "1/4 bille";
    return "Contact très fin";
}

function tracePath(start, direction, color, length = 450) {
    const dir = normalize(direction.x, direction.y);

    let x = start.x;
    let y = start.y;
    let remaining = length;

    const points = [`${x},${y}`];

    while (remaining > 0) {
        let distance = remaining;
        let hitX = false;
        let hitY = false;

        if (dir.x > 0) {
            const d = (945 - x) / dir.x;
            if (d > 0 && d < distance) {
                distance = d;
                hitX = true;
                hitY = false;
            }
        } else if (dir.x < 0) {
            const d = (55 - x) / dir.x;
            if (d > 0 && d < distance) {
                distance = d;
                hitX = true;
                hitY = false;
            }
        }

        if (dir.y > 0) {
            const d = (495 - y) / dir.y;
            if (d > 0 && d < distance) {
                distance = d;
                hitX = false;
                hitY = true;
            }
        } else if (dir.y < 0) {
            const d = (55 - y) / dir.y;
            if (d > 0 && d < distance) {
                distance = d;
                hitX = false;
                hitY = true;
            }
        }

        x += dir.x * distance;
        y += dir.y * distance;
        remaining -= distance;

        points.push(`${x},${y}`);

        if (distance === 0 || (!hitX && !hitY)) break;

        if (hitX) dir.x *= -1;
        if (hitY) dir.y *= -1;

        if (points.length > 8) break;
    }

    trajectoryLayer.appendChild(createSvg("polyline", {
        points: points.join(" "),
        fill: "none",
        stroke: color,
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-dasharray": "10 7"
    }));
}

function drawTrajectories(g) {
    trajectoryLayer.innerHTML = "";

    if (!showTrajectories) return;

    // Direction de la bille cible après le choc.
    const targetDirection = {
        x: -g.normal.x,
        y: -g.normal.y
    };

    tracePath(g.target, targetDirection, "#ff5b5b", 380);

    // Décomposition de la vitesse de la blanche.
    const dot =
        g.incoming.x * g.normal.x +
        g.incoming.y * g.normal.y;

    const tangent = {
        x: g.incoming.x - dot * g.normal.x,
        y: g.incoming.y - dot * g.normal.y
    };

    // Réaction simplifiée de la blanche.
    const retroAmount = spinY * 0.55;
    const sideAmount = spinX * 0.30;

    let cueDirection = {
        x: tangent.x + g.normal.x * retroAmount -
            g.normal.y * sideAmount,
        y: tangent.y + g.normal.y * retroAmount +
            g.normal.x * sideAmount
    };

    const cueLength = Math.hypot(cueDirection.x, cueDirection.y);

    if (cueLength > 0.05) {
        tracePath(g.contact, cueDirection, "#f1cf50", 350);
    }

    // Tangente théorique au moment du choc.
    const tangentLength = Math.hypot(tangent.x, tangent.y);

    if (tangentLength > 0.05) {
        const t = normalize(tangent.x, tangent.y);

        addLine(
            trajectoryLayer,
            g.contact.x,
            g.contact.y,
            g.contact.x + t.x * 130,
            g.contact.y + t.y * 130,
            "#55dc9a",
            2,
            "5 6"
        );
    }
}

function drawAim(g) {
    aimLayer.innerHTML = "";

    // Ligne de visée entre la blanche et le centre fantôme.
    addLine(
        aimLayer,
        g.cue.x,
        g.cue.y,
        g.ghost.x,
        g.ghost.y,
        "#ffffff",
        2,
        "8 6"
    );

    // Centre fantôme.
    addCircle(
        aimLayer,
        g.ghost.x,
        g.ghost.y,
        R,
        "#ffffff22",
        "#ffffff",
        2
    );

    // Point de contact sur la bille cible.
    addCircle(
        aimLayer,
        g.contact.x,
        g.contact.y,
        4,
        "#ff3333",
        "#ffffff",
        1
    );

    // Repère rouge orientable autour de la cible.
    addCircle(
        aimLayer,
        g.target.x,
        g.target.y,
        R + 12,
        "none",
        "#ff4d4d",
        2
    );

    addLine(
        aimLayer,
        g.target.x,
        g.target.y,
        g.contact.x,
        g.contact.y,
        "#ff4d4d",
        2
    );

    // Poignée à attraper avec la souris.
    const handle = createSvg("circle", {
        cx: g.contact.x,
        cy: g.contact.y,
        r: 9,
        fill: "#ff4545",
        stroke: "#ffffff",
        "stroke-width": 2,
        class: "aim-handle"
    });

    aimLayer.appendChild(handle);

    handle.addEventListener("pointerdown", event => {
        event.stopPropagation();
        activeDrag = { type: "aim" };
        handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", event => {
        if (!activeDrag || activeDrag.type !== "aim") return;

        const point = pointFromEvent(event);
        const target = getBall("target");

        aimAngle = Math.atan2(
            point.y - target.y,
            point.x - target.x
        );

        draw();
    });

    handle.addEventListener("pointerup", () => {
        if (activeDrag?.type === "aim") activeDrag = null;
    });

    handle.addEventListener("pointercancel", () => {
        activeDrag = null;
    });
}

function updatePanel(g) {
    $("contactType").textContent = contactName(g.overlap);
    $("overlap").textContent =
        Math.round(g.overlap * 100) + " %";

    $("impactInfo").textContent =
        Math.round(g.contact.x) + " / " +
        Math.round(g.contact.y);

    $("verticalValue").textContent =
        spinY < -0.15 ? "Coulé" :
        spinY > 0.15 ? "Rétro" : "Neutre";

    $("sideValue").textContent =
        spinX < -0.15 ? "Gauche" :
        spinX > 0.15 ? "Droite" : "Neutre";
}

function draw() {
    drawBalls();

    const geometry = getGeometry();

    drawTrajectories(geometry);
    drawAim(geometry);
    updatePanel(geometry);
}

// Déplacement du repère de visée.
svg.addEventListener("pointermove", event => {
    if (!activeDrag) return;

    if (activeDrag.type === "aim") {
        const point = pointFromEvent(event);
        const target = getBall("target");

        aimAngle = Math.atan2(
            point.y - target.y,
            point.x - target.x
        );

        draw();
    }
});

svg.addEventListener("pointerup", () => {
    activeDrag = null;
});

svg.addEventListener("pointercancel", () => {
    activeDrag = null;
});

// Effets prédéfinis.
document.querySelectorAll(".effect").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".effect").forEach(b => {
            b.classList.remove("active");
        });

        button.classList.add("active");

        effect = button.dataset.effect;

        const presets = {
            centre: [0, 0],
            retro: [0, 0.75],
            coule: [0, -0.75],
            gauche: [-0.75, 0],
            droite: [0.75, 0]
        };

        [spinX, spinY] = presets[effect];

        updateSpinPoint();
        draw();
    });
});

// Sélection libre du point d'effet.
const spinBall = $("spinBall");

function updateSpin(event) {
    const rect = spinBall.getBoundingClientRect();

    const x = clamp(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -1,
        1
    );

    const y = clamp(
        (event.clientY - rect.top) / rect.height * 2 - 1,
        -1,
        1
    );

    const length = Math.hypot(x, y);

    spinX = length > 1 ? x / length : x;
    spinY = length > 1 ? y / length : y;

    effect = "personnalise";

    document.querySelectorAll(".effect").forEach(b => {
        b.classList.remove("active");
    });

    updateSpinPoint();
    draw();
}

function updateSpinPoint() {
    $("spinPoint").style.left =
        (50 + spinX * 40) + "%";

    $("spinPoint").style.top =
        (50 + spinY * 40) + "%";
}

spinBall.addEventListener("pointerdown", event => {
    spinBall.setPointerCapture(event.pointerId);
    updateSpin(event);
});

spinBall.addEventListener("pointermove", event => {
    if (event.buttons === 1) updateSpin(event);
});

// Afficher ou masquer les trajectoires.
$("showLines").addEventListener("click", () => {
    showTrajectories = !showTrajectories;
    draw();
});

// Réinitialisation.
$("resetBtn").addEventListener("click", () => {
    balls = [
        { id: "white", x: 300, y: 275, color: "#ffffff" },
        { id: "target", x: 610, y: 275, color: "#e83e42" },
        { id: "yellow", x: 760, y: 180, color: "#f2d044" },
        { id: "black", x: 760, y: 370, color: "#171717" }
    ];

    aimAngle = Math.PI;
    spinX = 0;
    spinY = 0;
    activeDrag = null;

    document.querySelectorAll(".effect").forEach(b => {
        b.classList.toggle("active", b.dataset.effect === "centre");
    });

    updateSpinPoint();
    draw();
});

updateSpinPoint();
draw();
