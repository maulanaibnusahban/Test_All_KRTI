document.addEventListener("DOMContentLoaded", () => {
    // API endpoints
    const API_BASE = "";
    
    // Elements
    const btnConnect = document.getElementById("btn-connect");
    const btnDisconnect = document.getElementById("btn-disconnect");
    const statusText = document.getElementById("conn-status");
    const portInput = document.getElementById("com-port");
    const baudrateInput = document.getElementById("baudrate");
    
    const btnArm = document.getElementById("btn-arm");
    const btnDisarm = document.getElementById("btn-disarm");
    const btnPlan = document.getElementById("btn-plan");
    
    const logOutput = document.getElementById("log-output");
    const autoScrollCb = document.getElementById("auto-scroll");
    const btnClearLog = document.getElementById("btn-clear-log");
    
    // Polling intervals
    let pollInterval = null;
    let isConnected = false;

    // Connect
    btnConnect.addEventListener("click", async () => {
        const port = portInput.value.trim();
        const baudrate = parseInt(baudrateInput.value);
        if (!port) return alert("Please enter COM Port");
        
        try {
            const res = await fetch(`${API_BASE}/api/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ port, baudrate })
            });
            const data = await res.json();
            if (data.status === "success") {
                isConnected = true;
                statusText.textContent = "Online";
                statusText.className = "status-online";
                btnConnect.disabled = true;
                btnDisconnect.disabled = false;
                startPolling();
            } else {
                alert("Connection failed: " + data.message);
            }
        } catch (e) {
            alert("Server not reachable");
        }
    });

    // Disconnect
    btnDisconnect.addEventListener("click", async () => {
        try {
            await fetch(`${API_BASE}/api/disconnect`, { method: "POST" });
            isConnected = false;
            statusText.textContent = "Offline";
            statusText.className = "status-offline";
            btnConnect.disabled = false;
            btnDisconnect.disabled = true;
            stopPolling();
        } catch (e) {
            console.error(e);
        }
    });

    // Send Command
    const sendCommand = async (cmd) => {
        if (!isConnected) return alert("Not connected");
        try {
            await fetch(`${API_BASE}/api/command`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: cmd })
            });
        } catch (e) {
            console.error(e);
        }
    };

    btnArm.addEventListener("click", () => sendCommand("ARM"));
    btnDisarm.addEventListener("click", () => sendCommand("DISARM"));
    btnPlan.addEventListener("click", () => sendCommand("PLAN"));

    // Polling Loop
    const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            await updateTelemetry();
            await updatePhoto();
            await updateLogs();
        }, 500); // Poll every 500ms
    };

    const stopPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
    };

    // Update Telemetry
    const updateTelemetry = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/telemetry`);
            const data = await res.json();
            if (data && data.type === "telemetry") {
                document.getElementById("tel-roll").textContent = data.roll.toFixed(2);
                document.getElementById("tel-pitch").textContent = data.pitch.toFixed(2);
                document.getElementById("tel-yaw").textContent = data.yaw.toFixed(2);
                document.getElementById("tel-lat").textContent = data.lat.toFixed(6);
                document.getElementById("tel-lon").textContent = data.lon.toFixed(6);
                document.getElementById("tel-alt").textContent = data.alt.toFixed(1) + " m";
                document.getElementById("tel-rel-alt").textContent = data.rel_alt.toFixed(1) + " m";
                document.getElementById("tel-vx").textContent = data.vx.toFixed(2);
                document.getElementById("tel-vy").textContent = data.vy.toFixed(2);
                document.getElementById("tel-vz").textContent = data.vz.toFixed(2);
                document.getElementById("tel-gps").textContent = data.gps_fix;
                document.getElementById("tel-sat").textContent = data.sat;
                document.getElementById("tel-battery").textContent = data.battery.toFixed(1) + " V";
                document.getElementById("tel-battery-pct").textContent = data.battery_pct + "%";
                document.getElementById("tel-armed").textContent = data.armed;
                document.getElementById("tel-mode").textContent = data.mode;
            }
        } catch (e) {}
    };

    // Update Photo
    let lastPhotoId = null;
    const updatePhoto = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/photo`);
            const data = await res.json();
            if (data && data.photo_id) {
                if (data.photo_id !== lastPhotoId) {
                    lastPhotoId = data.photo_id;
                    const imgEl = document.getElementById("latest-photo");
                    imgEl.src = `${API_BASE}${data.path}?t=${new Date().getTime()}`; // cache bust
                    imgEl.style.display = "block";
                    document.getElementById("photo-placeholder").style.display = "none";
                    
                    document.getElementById("photo-id").textContent = data.photo_id;
                    document.getElementById("photo-lat").textContent = data.lat;
                    document.getElementById("photo-lon").textContent = data.lon;
                    document.getElementById("photo-time").textContent = data.timestamp;
                }
            }
        } catch (e) {}
    };

    // Update Logs
    const updateLogs = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/logs`);
            const data = await res.json();
            if (data && data.logs && data.logs.length > 0) {
                data.logs.forEach(log => {
                    const span = document.createElement("div");
                    span.className = "log-entry";
                    
                    if (log.startsWith("[RX]")) span.classList.add("log-rx");
                    else if (log.startsWith("[TX]")) span.classList.add("log-tx");
                    
                    span.textContent = log;
                    logOutput.appendChild(span);
                });
                
                if (autoScrollCb.checked) {
                    logOutput.scrollTop = logOutput.scrollHeight;
                }
            }
        } catch (e) {}
    };

    btnClearLog.addEventListener("click", () => {
        logOutput.innerHTML = "";
    });
});
