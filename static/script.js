(function () {
  "use strict";

  const PREDICT_URL  = "/predict";
  const METRICS_URL  = "/metrics";
  const ANIM_DELAY   = 600; 

  let selectedModel    = "Random Forest";
  let activeFetchCtrl  = null; 

  const menuBtn    = document.getElementById("menu-btn");
  const navLinks   = document.getElementById("nav-links");
  const predictBtn = document.getElementById("predict-btn");
  const errBox     = document.getElementById("error-box");
  const resBox     = document.getElementById("result-box");

  document.body.classList.add("js-active");

  function openNav() {
    navLinks.classList.add("active");
    menuBtn.textContent = "✕";
    menuBtn.setAttribute("aria-expanded", "true");
  }

  function closeNav() {
    navLinks.classList.remove("active");
    menuBtn.textContent = "☰";
    menuBtn.setAttribute("aria-expanded", "false");
  }

  menuBtn.addEventListener("click", () => {
    navLinks.classList.contains("active") ? closeNav() : openNav();
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks.classList.contains("active")) {
      closeNav();
      menuBtn.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (
      navLinks.classList.contains("active") &&
      !navLinks.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      closeNav();
    }
  });

  document.querySelector(".model-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".model-btn");
    if (!btn) return;

    document.querySelectorAll(".model-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedModel = btn.dataset.model;
  });

  function showError(msg) {
    errBox.textContent = msg;
    errBox.classList.add("show");
    resBox.classList.remove("show");
  }

  function clearMessages() {
    errBox.classList.remove("show");
    resBox.classList.remove("show");
    errBox.textContent = "";
  }

  function safeInt(id) {
    const val = document.getElementById(id)?.value.trim();
    if (!val) return NaN;
    return parseInt(val, 10);
  }

  async function predict() {
    clearMessages();

    const areaVal = safeInt("area");
    const bhkVal  = safeInt("bhk");
    const bathVal = safeInt("bathroom");

    if (isNaN(areaVal) || areaVal < 100 || areaVal > 10000) {
      showError("⚠ Area must be between 100 and 10,000 sqft.");
      return;
    }
    if (isNaN(bhkVal) || bhkVal < 1 || bhkVal > 10) {
      showError("⚠ BHK must be between 1 and 10.");
      return;
    }
    if (isNaN(bathVal) || bathVal < 1 || bathVal > 10) {
      showError("⚠ Bathrooms must be between 1 and 10.");
      return;
    }

    if (activeFetchCtrl) activeFetchCtrl.abort();
    activeFetchCtrl = new AbortController();

    predictBtn.disabled = true;
    predictBtn.innerHTML = '<span class="spinner"></span> Predicting…';

    const payload = {
      city:       document.getElementById("city").value,
      area:       areaVal,
      bhk:        bhkVal,
      bathroom:   bathVal,
      furnishing: document.getElementById("furnishing").value,
      tenant:     document.getElementById("tenant").value,
      model:      selectedModel,
    };

    try {
      const res = await fetch(PREDICT_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  activeFetchCtrl.signal,
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      document.getElementById("result-rent").textContent =
        "₹ " + Number(data.rent).toLocaleString("en-IN");
      document.getElementById("res-model").textContent = data.model;
      document.getElementById("res-r2").textContent    = data.r2;
      document.getElementById("res-rmse").textContent  =
         Number(data.rmse).toLocaleString("en-IN");

      resBox.classList.add("show");
    } catch (e) {
      if (e.name === "AbortError") return;
      showError("⚠ " + (e.message || "Prediction failed. Is the Flask server running?"));
    } finally {
      activeFetchCtrl      = null;
      predictBtn.disabled  = false;
      predictBtn.innerHTML = "₹ Predict Monthly Rent";
    }
  }

  predictBtn.addEventListener("click", predict);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) predict();
  });

  async function loadMetrics() {
    try {
      const res = await fetch(METRICS_URL);
      if (!res.ok) return;

      const m  = await res.json();
      const rf = m?.["Random Forest"];
      const lr = m?.["Linear Regression"];

      if (!rf || !lr) return;

      document.getElementById("rf-r2").textContent   = rf.r2;
      document.getElementById("rf-rmse").textContent = Number(rf.rmse).toLocaleString("en-IN");
      document.getElementById("lr-r2").textContent   = lr.r2;
      document.getElementById("lr-rmse").textContent = Number(lr.rmse).toLocaleString("en-IN");

      setTimeout(() => {
        const rfPct = (rf.r2 * 100).toFixed(1) + "%";
        const lrPct = (lr.r2 * 100).toFixed(1) + "%";

        document.getElementById("rf-bar").style.width = rfPct;
        document.getElementById("lr-bar").style.width = lrPct;
        document.getElementById("rf-pct").textContent = rfPct;
        document.getElementById("lr-pct").textContent = lrPct;
      }, ANIM_DELAY);
    } catch {
    }
  }

  loadMetrics();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
  );

  document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));
})();