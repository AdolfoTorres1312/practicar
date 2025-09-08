/* =========================================================
   MEDULA — Portal Paciente
   JavaScript de comportamiento (Desktop)
   ========================================================= */

(function () {
  // ----------------------------
  // Helpers básicos
  // ----------------------------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const LS_KEYS = {
    EVENTS: "medula_events",
    THEME: "medula_theme",
    FONT: "medula_fontScale",
    VIEW: "medula_view",
    CURR: "medula_current", // {y,m,d}
  };

  const months = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];
  const dows = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  const pad2 = n => String(n).padStart(2, "0");
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fromISODate = (iso) => {
    const [y,m,dd] = iso.split("-").map(Number);
    return new Date(y, m-1, dd);
  };
  const toISOTime = (h="00:00") => h ? h : "00:00";

  const isSameDay = (a, b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

  const mondayIndex = (d) => (d.getDay() + 6) % 7; // Lunes=0 ... Domingo=6
  const startOfWeek = (d) => {
    const tmp = new Date(d);
    const mi = mondayIndex(tmp);
    tmp.setDate(tmp.getDate() - mi);
    tmp.setHours(0,0,0,0);
    return tmp;
  };

  const parseDateTime = (isoDate, hhmm) => {
    const [y,m,dd] = isoDate.split("-").map(Number);
    let H=0, M=0;
    if (hhmm && /^\d{2}:\d{2}$/.test(hhmm)) { [H,M] = hhmm.split(":").map(Number); }
    return new Date(y, m-1, dd, H, M, 0, 0);
  };

  // ----------------------------
  // Estado
  // ----------------------------
  const state = {
    events: [],
    view: "month", // month|week|list
    current: new Date(),
    search: "",
    fontScale: 0,  // 0=17px, 1=19px, 2=21px
    themeDark: false,
  };

  // ----------------------------
  // Cargar estado desde localStorage
  // ----------------------------
  function loadState() {
    try {
      const ev = localStorage.getItem(LS_KEYS.EVENTS);
      state.events = ev ? JSON.parse(ev) : [];
    } catch { state.events = []; }

    const v = localStorage.getItem(LS_KEYS.VIEW);
    if (v) state.view = v;

    const c = localStorage.getItem(LS_KEYS.CURR);
    if (c) {
      const obj = JSON.parse(c);
      state.current = new Date(obj.y, obj.m, obj.d);
    }

    const t = localStorage.getItem(LS_KEYS.THEME);
    state.themeDark = t === "dark";
    applyTheme();

    const f = localStorage.getItem(LS_KEYS.FONT);
    state.fontScale = f ? Number(f) : 0;
    applyFontScale();

    // Si no hay eventos guardados, sembrar algunos de ejemplo (evita lista vacía)
    if (!state.events || state.events.length === 0) {
      seedInitialEventsIfEmpty();
      saveEvents();
    }
  }

  function saveEvents() {
    localStorage.setItem(LS_KEYS.EVENTS, JSON.stringify(state.events));
  }
  function saveView() {
    localStorage.setItem(LS_KEYS.VIEW, state.view);
  }
  function saveCurrent() {
    const d = state.current;
    localStorage.setItem(LS_KEYS.CURR, JSON.stringify({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() }));
  }
  function saveTheme() {
    localStorage.setItem(LS_KEYS.THEME, state.themeDark ? "dark" : "light");
  }
  function saveFont() {
    localStorage.setItem(LS_KEYS.FONT, String(state.fontScale));
  }

  // ----------------------------
  // Semilla de eventos iniciales
  // ----------------------------
  function seedInitialEventsIfEmpty() {
    // Crea algunos eventos en el mes actual para que "Próximas Citas" no aparezca vacío
    const y = state.current.getFullYear();
    const m = state.current.getMonth(); // 0-11
    const mkDate = (day) => `${y}-${pad2(m+1)}-${pad2(day)}`;

    const seed = [
      { title:"Vacuna Influenza", type:"medicamento", date: mkDate(5),  time:"09:00", location:"CESFAM La Florida", notes:"Dosis anual" },
      { title:"Control nutrición", type:"consulta",   date: mkDate(13), time:"12:30", location:"Clínica Central",   notes:"Revisión de pauta" },
      { title:"Hemograma",         type:"examen",     date: mkDate(25), time:"08:00", location:"Laboratorio X",      notes:"Ayuno 8h" }
    ];
    seed.forEach(s => addEvent(s, {persist:false}));
  }

  // ----------------------------
  // Tema y tipografía
  // ----------------------------
  function applyTheme() {
    document.body.classList.toggle("theme-dark", state.themeDark);
    const btn = $("#btn-dark");
    if (btn) btn.setAttribute("aria-pressed", state.themeDark ? "true" : "false");
  }

  function toggleTheme() {
    state.themeDark = !state.themeDark;
    applyTheme();
    saveTheme();
  }

  function applyFontScale() {
    const sizes = ["17px","19px","21px"];
    const size = sizes[state.fontScale] || sizes[0];
    document.documentElement.style.setProperty("--base-font", size);
    const btn = $("#btn-font");
    if (btn) btn.setAttribute("aria-pressed", state.fontScale > 0 ? "true" : "false");
  }

  function cycleFontScale() {
    state.fontScale = (state.fontScale + 1) % 3;
    applyFontScale();
    saveFont();
  }

  // ----------------------------
  // Eventos (datos)
  // ----------------------------
  function addEvent(evt, {persist=true} = {}) {
    // evt: {title,type,date,time,location,notes}
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      title: (evt.title||"").trim(),
      type: evt.type || "consulta",
      date: evt.date, // ISO yyyy-mm-dd
      time: evt.time || "",
      location: evt.location || "",
      notes: evt.notes || "",
      createdAt: new Date().toISOString()
    };
    state.events.push(item);
    if (persist) saveEvents();
    return item;
  }

  function removeEventById(id) {
    const idx = state.events.findIndex(e=>e.id===id);
    if (idx >= 0) {
      const [removed] = state.events.splice(idx,1);
      saveEvents();
      return removed;
    }
    return null;
  }

  function removeAllEvents() {
    state.events = [];
    saveEvents();
  }

  function filteredEvents(query) {
    if (!query) return state.events.slice();
    const q = query.toLowerCase();
    return state.events.filter(e =>
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.location && e.location.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q))
    );
  }

  function eventsForDate(isoDate, query) {
    return filteredEvents(query).filter(e => e.date === isoDate);
  }

  function upcomingEvents({type="all"} = {}) {
    const now = new Date();
    return state.events
      .slice()
      .sort((a,b) => parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time))
      .filter(e => parseDateTime(e.date, e.time) >= now)
      .filter(e => type==="all" ? true : e.type === type);
  }

  // ----------------------------
  // Render: calendario
  // ----------------------------
  function setHeaderMonthYear(d = state.current) {
    $("#monthName").textContent = months[d.getMonth()];
    $("#yearNum").textContent = d.getFullYear();
  }

  function renderMonth() {
    const grid = $("#calGrid");
    if (!grid) return;

    grid.innerHTML = "";

    // fila de nombres de días
    dows.forEach(dw => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = dw;
      grid.appendChild(el);
    });

    const year = state.current.getFullYear();
    const month = state.current.getMonth();

    const first = new Date(year, month, 1);
    const start = new Date(first);
    const offset = mondayIndex(first); // 0..6
    start.setDate(1 - offset);

    // 42 celdas (6 semanas)
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODate(d);

      const cell = document.createElement("div");
      cell.className = "cal-cell";
      cell.dataset.date = iso;

      const day = document.createElement("div");
      day.className = "cal-day";
      day.textContent = String(d.getDate());
      cell.appendChild(day);

      const evWrap = document.createElement("div");
      evWrap.className = "events";
      const dayEvents = eventsForDate(iso, state.search);
      dayEvents.slice(0, 3).forEach(e => {
        const a = document.createElement("a");
        a.href = "#";
        a.className = "cal-event";
        a.dataset.type = e.type;
        a.textContent = (e.time ? `${e.time} — ` : "") + e.title;
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          openModal(e.title, buildEventDetail(e));
        });
        evWrap.appendChild(a);
      });
      cell.appendChild(evWrap);

      if (dayEvents.length > 0) {
        const c = document.createElement("div");
        c.className = "count";
        c.textContent = String(dayEvents.length);
        cell.appendChild(c);
      }

      // Atenúa días fuera de mes (opcional visual)
      if (d.getMonth() !== month) {
        cell.style.opacity = ".55";
      }

      grid.appendChild(cell);
    }
  }

  function renderWeek() {
    const wrap = $("#weekGrid");
    if (!wrap) return;
    wrap.innerHTML = "";

    const start = startOfWeek(state.current);
    for (let i=0;i<7;i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODate(d);

      const col = document.createElement("div");
      col.className = "week-col";

      const h = document.createElement("h4");
      h.textContent = `${dows[i]} ${d.getDate()}/${pad2(d.getMonth()+1)}`;
      col.appendChild(h);

      const evs = eventsForDate(iso, state.search);
      evs.forEach(e=>{
        const item = document.createElement("div");
        item.className = "week-item";
        item.dataset.type = e.type;
        item.textContent = (e.time ? `${e.time} — ` : "") + e.title;
        item.addEventListener("click", ()=> openModal(e.title, buildEventDetail(e)));
        col.appendChild(item);
      });

      wrap.appendChild(col);
    }
  }

  function renderList() {
    const wrap = $("#listWrap");
    if (!wrap) return;
    wrap.innerHTML = "";

    const y = state.current.getFullYear();
    const m = state.current.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);

    // todos los eventos del mes actual (filtrados por búsqueda)
    const monthEvents = filteredEvents(state.search)
      .filter(e => {
        const d = fromISODate(e.date);
        return d.getMonth()===m && d.getFullYear()===y;
      })
      .sort((a,b)=> parseDateTime(a.date, a.time) - parseDateTime(b.date, b.time));

    // Agrupar por día
    const byDay = new Map();
    monthEvents.forEach(e=>{
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date).push(e);
    });

    // Recorrer por día del mes
    for (let d = new Date(first); d <= last; d.setDate(d.getDate()+1)) {
      const iso = toISODate(d);
      const evs = byDay.get(iso) || [];
      if (evs.length === 0) continue;

      const dayBox = document.createElement("div");
      dayBox.className = "list-day";

      const h = document.createElement("h4");
      h.textContent = `${d.getDate()} ${months[m]} ${y}`;
      dayBox.appendChild(h);

      evs.forEach(e=>{
        const a = document.createElement("a");
        a.href="#";
        a.className="cal-event";
        a.dataset.type = e.type;
        a.textContent = (e.time ? `${e.time} — ` : "") + e.title;
        a.addEventListener("click", (ev)=>{
          ev.preventDefault();
          openModal(e.title, buildEventDetail(e));
        });
        dayBox.appendChild(a);
      });

      wrap.appendChild(dayBox);
    }

    if (!wrap.children.length) {
      const empty = document.createElement("div");
      empty.className = "subtitle";
      empty.textContent = "No hay eventos en esta vista.";
      wrap.appendChild(empty);
    }
  }

  function renderCalendar() {
    setHeaderMonthYear();
    $("#monthView").hidden = state.view !== "month";
    $("#weekView").hidden  = state.view !== "week";
    $("#listView").hidden  = state.view !== "list";

    $("#viewMonth").setAttribute("aria-pressed", state.view==="month" ? "true" : "false");
    $("#viewWeek").setAttribute("aria-pressed",  state.view==="week"  ? "true" : "false");
    $("#viewList").setAttribute("aria-pressed",  state.view==="list"  ? "true" : "false");

    if (state.view === "month") renderMonth();
    else if (state.view === "week") renderWeek();
    else renderList();
  }

  // ----------------------------
  // Próximas citas (+ draggable)
  // ----------------------------
  function renderUpcoming() {
    const list = $("#apptList");
    if (!list) return;
    list.innerHTML = "";

    const sel = $("#filterType");
    const type = sel ? sel.value : "all";

    const ups = upcomingEvents({type});
    if (ups.length === 0) {
      const empty = document.createElement("div");
      empty.className = "subtitle";
      empty.textContent = "Sin próximas citas.";
      list.appendChild(empty);
      return;
    }

    ups.forEach(e=>{
      const card = document.createElement("div");
      card.className = "appt";
      card.setAttribute("draggable", "true");
      card.dataset.id = e.id;

      const dt = parseDateTime(e.date, e.time);
      const dateStr = `${pad2(dt.getDate())}/${pad2(dt.getMonth()+1)}/${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;

      card.innerHTML = `
        <div class="appt-time">${dateStr}</div>
        <div><strong>${e.title}</strong></div>
        <div class="subtitle">${prettyType(e.type)} ${e.location ? "• " + e.location : ""}</div>
      `;
      card.addEventListener("click", ()=> openModal(e.title, buildEventDetail(e)));

      // Drag & drop para eliminar en el basurero
      card.addEventListener("dragstart", (ev)=>{
        card.classList.add("dragging");
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", e.id);
      });
      card.addEventListener("dragend", ()=>{
        card.classList.remove("dragging");
      });

      list.appendChild(card);
    });
  }

  function prettyType(t) {
    if (t==="consulta") return "Consulta";
    if (t==="examen") return "Examen";
    if (t==="medicamento") return "Medicamento";
    return t;
  }

  // ----------------------------
  // Buscador
  // ----------------------------
  function setSearch(q) {
    state.search = q.trim();
    renderCalendar();
    renderUpcoming(); // que también refresque la lista
  }

  // ----------------------------
  // Modal
  // ----------------------------
  function openModal(title, body) {
    const m = $("#modal");
    $("#modalTitle").textContent = title || "Detalle";
    $("#modalBody").textContent = body || "";
    m.classList.add("open");
  }
  function closeModal() {
    $("#modal").classList.remove("open");
  }
  function buildEventDetail(e) {
    const dt = parseDateTime(e.date, e.time);
    const fdate = `${pad2(dt.getDate())}/${pad2(dt.getMonth()+1)}/${dt.getFullYear()}`;
    const ftime = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    return [
      `📌 ${e.title}`,
      `🗓️ ${fdate}${e.time? " " + ftime : ""}`,
      `🏷️ ${prettyType(e.type)}`,
      e.location ? `📍 ${e.location}` : "",
      e.notes ? `📝 ${e.notes}` : ""
    ].filter(Boolean).join("\n");
  }

  // ----------------------------
  // Exportar ICS
  // ----------------------------
  function toICSDateTime(isoDate, hhmm) {
    const d = parseDateTime(isoDate, hhmm);
    return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  }

  function download(filename, content, type="text/calendar") {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function icsForEvent(e) {
    const dtStart = toICSDateTime(e.date, e.time || "09:00");
    const dtEnd   = toICSDateTime(e.date, e.time ? addMinutes(e.time, 30) : "09:30");
    const uid = e.id || (Date.now()+"@medula");
    const desc = [e.location ? `Lugar: ${e.location}`:"", e.notes||""].filter(Boolean).join("\\n");

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MEDULA//Portal Paciente//ES",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toICSDateTime(toISODate(new Date()), "00:00")}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(e.title)}`,
      e.location ? `LOCATION:${escapeICS(e.location)}` : "",
      desc ? `DESCRIPTION:${escapeICS(desc)}` : "",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");
  }

  function icsForAll(events) {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MEDULA//Portal Paciente//ES",
      "CALSCALE:GREGORIAN"
    ];
    events.forEach(e=>{
      const dtStart = toICSDateTime(e.date, e.time || "09:00");
      const dtEnd   = toICSDateTime(e.date, e.time ? addMinutes(e.time, 30) : "09:30");
      const uid = e.id || (Date.now()+"@medula");
      const desc = [e.location ? `Lugar: ${e.location}`:"", e.notes||""].filter(Boolean).join("\\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toICSDateTime(toISODate(new Date()), "00:00")}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeICS(e.title)}`,
        e.location ? `LOCATION:${escapeICS(e.location)}` : "",
        desc ? `DESCRIPTION:${escapeICS(desc)}` : "",
        "END:VEVENT"
      );
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function escapeICS(s) {
    return String(s)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function addMinutes(hhmm, mins) {
    const [H,M] = hhmm.split(":").map(Number);
    const d = new Date(2000,0,1,H,M);
    d.setMinutes(d.getMinutes() + mins);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  // ----------------------------
  // Listeners UI
  // ----------------------------
  function wire() {
    // Tema y fuente
    $("#btn-dark")?.addEventListener("click", toggleTheme);
    $("#btn-font")?.addEventListener("click", cycleFontScale);

    // Navegación lateral
    $("#link-historial")?.addEventListener("click", (e)=>{ e.preventDefault(); showSection("historial"); setActiveLink("link-historial"); });
    $("#link-medicamentos")?.addEventListener("click", (e)=>{ e.preventDefault(); showSection("medicamentos"); setActiveLink("link-medicamentos"); });
    $("#link-examenes")?.addEventListener("click", (e)=>{ e.preventDefault(); showSection("examenes"); setActiveLink("link-examenes"); });
    $("#link-perfil")?.addEventListener("click", (e)=>{ e.preventDefault(); showSection("perfil"); setActiveLink("link-perfil"); });

    // Botón usuario → Perfil
    $("#userCardBtn")?.addEventListener("click", (e)=>{
      e.preventDefault();
      showSection("perfil");
      setActiveLink("link-perfil");
      $(".main")?.scrollTo({top:0,behavior:"smooth"});
    });

    // View buttons
    $("#viewMonth")?.addEventListener("click", ()=>{ state.view="month"; saveView(); renderCalendar(); });
    $("#viewWeek")?.addEventListener("click", ()=>{ state.view="week"; saveView(); renderCalendar(); });
    $("#viewList")?.addEventListener("click", ()=>{ state.view="list"; saveView(); renderCalendar(); });

    // Prev / Today / Next
    $("#prevMonth")?.addEventListener("click", ()=>{
      if (state.view==="week") { state.current.setDate(state.current.getDate()-7); }
      else { state.current.setMonth(state.current.getMonth()-1); }
      saveCurrent(); renderCalendar();
    });
    $("#todayBtn")?.addEventListener("click", ()=>{
      state.current = new Date();
      saveCurrent(); renderCalendar();
    });
    $("#nextMonth")?.addEventListener("click", ()=>{
      if (state.view==="week") { state.current.setDate(state.current.getDate()+7); }
      else { state.current.setMonth(state.current.getMonth()+1); }
      saveCurrent(); renderCalendar();
    });

    // Buscador global
    $("#searchBox")?.addEventListener("input", (e)=> setSearch(e.target.value));
    // Atajo Ctrl/Cmd+K (sigue funcionando aunque ya no lo muestres en placeholder)
    document.addEventListener("keydown", (e)=>{
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if ((isMac && e.metaKey && e.key.toLowerCase()==="k") ||
          (!isMac && e.ctrlKey && e.key.toLowerCase()==="k")) {
        e.preventDefault();
        $("#searchBox")?.focus();
      }
    });

    // Formulario
    $("#reminderForm")?.addEventListener("submit", onAddEvent);
    $("#exportICSBtn")?.addEventListener("click", onExportFormICS);

    // Próximas citas: filtro
    $("#filterType")?.addEventListener("change", renderUpcoming);

    // Basurero: click = borrar todo (como antes)
    const trash = $("#clearAll");
    trash?.addEventListener("click", ()=>{
      if (confirm("¿Borrar todos los recordatorios?")) {
        removeAllEvents();
        renderCalendar();
        renderUpcoming();
      }
    });

    // Basurero: zona de DROP para borrar uno por uno
    if (trash) {
      ["dragenter","dragover"].forEach(evName=>{
        trash.addEventListener(evName, (ev)=>{
          ev.preventDefault();
          trash.classList.add("drop-ready");
          ev.dataTransfer.dropEffect = "move";
        });
      });
      ["dragleave","drop"].forEach(evName=>{
        trash.addEventListener(evName, ()=>{
          trash.classList.remove("drop-ready");
        });
      });
      trash.addEventListener("drop", (ev)=>{
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text/plain");
        if (!id) return;
        const removed = removeEventById(id);
        if (removed) {
          renderCalendar();
          renderUpcoming();
          toast(`Eliminado: ${removed.title}`);
        }
      });
    }

    // Notificaciones y export
    $("#btn-allow-notif")?.addEventListener("click", requestNotifications);
    $("#btn-export-all")?.addEventListener("click", ()=>{
      if (!state.events.length) return alert("No hay eventos para exportar.");
      const ics = icsForAll(state.events);
      download("medula_todos.ics", ics);
    });

    // Imprimir
    $("#btn-print")?.addEventListener("click", ()=> window.print());

    // Modal
    $("#closeModal")?.addEventListener("click", closeModal);
    $("#modal")?.addEventListener("click", (e)=>{ if (e.target.id==="modal") closeModal(); });

    // Botones "Ver" en historial/exámenes
    $$(".view-btn").forEach(b=>{
      b.addEventListener("click", ()=>{
        openModal(b.dataset.title || "Detalle", b.dataset.detail || "");
      });
    });

    // Hash inicial (si viene con #perfil, etc.)
    if (location.hash) {
      const id = location.hash.replace("#","");
      if ($(`#${id}.section`)) {
        showSection(id);
        setActiveLink(`link-${id}`);
      }
    }
  }

  function toast(msg) {
    try {
      // Reutiliza notificaciones si están habilitadas
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("MEDULA", { body: msg });
      }
    } catch {}
  }

  function showSection(id) {
    $$(".section").forEach(sec => sec.hidden = (sec.id !== id));
    location.hash = "#" + id;
  }
  function setActiveLink(linkId) {
    $$('nav[aria-label="Secciones"] a').forEach(a => a.classList.toggle("active", a.id === linkId));
  }

  // ----------------------------
  // Handlers de formulario
  // ----------------------------
  function onAddEvent(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = getFormData(form);
    if (!data.title || !data.type || !data.date) return;

    const item = addEvent(data, {persist:true});
    saveCurrentAfterAdd(item);
    renderCalendar();
    renderUpcoming();
    flashCell(item.date);

    notify(`Guardado: ${item.title}`, `${item.date} ${item.time||""}`.trim());

    const status = $("#formStatus");
    if (status) {
      status.textContent = "✅ Guardado";
      setTimeout(()=> status.textContent = "", 1500);
    }

    form.reset();
  }

  function onExportFormICS() {
    const form = $("#reminderForm");
    if (!form) return;
    const data = getFormData(form);
    if (!data.title || !data.type || !data.date) {
      alert("Completa al menos Título, Tipo y Fecha para exportar .ics");
      return;
    }
    // Guardar también al exportar
    const item = addEvent(data, {persist:true});
    renderCalendar();
    renderUpcoming();
    flashCell(item.date);

    const ics = icsForEvent(item);
    const safeTitle = item.title.toLowerCase().replace(/\s+/g,"_").replace(/[^\w\-]+/g,"");
    download(`medula_${safeTitle || "evento"}.ics`, ics);
  }

  function getFormData(form) {
    return {
      title: $("#title", form)?.value || "",
      type:  $("#type", form)?.value || "consulta",
      date:  $("#date", form)?.value || "",
      time:  $("#time", form)?.value || "",
      location: $("#location", form)?.value || "",
      notes: $("#notes", form)?.value || ""
    };
  }

  function saveCurrentAfterAdd(item) {
    const d = fromISODate(item.date);
    state.current = new Date(d.getFullYear(), d.getMonth(), 1);
    saveCurrent();
  }

  function flashCell(isoDate) {
    const cell = $(`.cal-cell[data-date="${isoDate}"]`);
    if (!cell) return;
    cell.classList.add("flash");
    setTimeout(()=> cell.classList.remove("flash"), 800);
  }

  // ----------------------------
  // Notificaciones
  // ----------------------------
  function requestNotifications() {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones.");
      return;
    }
    Notification.requestPermission().then((perm)=>{
      if (perm === "granted") {
        new Notification("MEDULA", { body: "Notificaciones activadas ✅" });
      } else {
        alert("Notificaciones no permitidas.");
      }
    });
  }

  function notify(title, body) {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch {}
  }

  // ----------------------------
  // Inicialización
  // ----------------------------
  function init() {
    loadState();

    // Ajustar encabezado y render inicial
    setHeaderMonthYear();
    renderCalendar();
    renderUpcoming();

    // Hook UI
    wire();

    // Estado de botones view desde LS
    $("#viewMonth")?.setAttribute("aria-pressed", state.view==="month" ? "true" : "false");
    $("#viewWeek")?.setAttribute("aria-pressed", state.view==="week" ? "true" : "false");
    $("#viewList")?.setAttribute("aria-pressed", state.view==="list" ? "true" : "false");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
