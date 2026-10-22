// Interface da EasyFood: roteamento por hash (#/...) e renderização das telas.
(function () {
  const { session } = window.api;
  const view = document.getElementById("view");
  const nav = document.getElementById("nav");

  const STATUS_LABEL = {
    PENDENTE: "Pendente",
    CONFIRMADO: "Confirmado",
    EM_PREPARO: "Em preparo",
    SAIU_PARA_ENTREGA: "Saiu para entrega",
    ENTREGUE: "Entregue",
    CANCELADO: "Cancelado"
  };

  // Espelha as transições do dono do restaurante definidas no backend (order-status.js)
  const RESTAURANT_NEXT = {
    PENDENTE: ["CONFIRMADO", "CANCELADO"],
    CONFIRMADO: ["EM_PREPARO", "CANCELADO"],
    EM_PREPARO: ["SAIU_PARA_ENTREGA"],
    SAIU_PARA_ENTREGA: ["ENTREGUE"]
  };

  const IMAGE_STATUS_LABEL = {
    NENHUMA: "Nenhuma foto enviada.",
    PROCESSANDO: "Processando imagem...",
    PRONTA: "Foto publicada.",
    ERRO: "Não foi possível processar a última imagem. Tente outro arquivo."
  };

  const ACTION_LABEL = {
    CONFIRMADO: "Confirmar",
    EM_PREPARO: "Iniciar preparo",
    SAIU_PARA_ENTREGA: "Saiu para entrega",
    ENTREGUE: "Marcar entregue",
    CANCELADO: "Cancelar"
  };

  // Carrinho: um restaurante por vez, como nos apps de delivery
  const cart = { restaurant: null, items: new Map() };

  const state = { search: "", category: "", managing: null };
  // Rascunho do checkout: preserva endereço/observações se o usuário precisar fazer login no meio
  const checkoutDraft = { deliveryAddress: "", notes: "" };

  // ------------------------------------------------------------------ utilidades
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  const money = (value) =>
    Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const initials = (name) =>
    name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const dateTime = (value) =>
    new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  // Foto otimizada do restaurante (quando pronta) ou as iniciais do nome
  const restaurantVisual = (r, cls = "avatar") =>
    r.imageUrl
      ? `<img class="${cls} photo" src="${esc(r.imageUrl)}" alt="Foto de ${esc(r.name)}" loading="lazy" />`
      : `<div class="${cls}" aria-hidden="true">${esc(initials(r.name))}</div>`;

  const badge = (status) => `<span class="badge badge-${status}">${STATUS_LABEL[status] || status}</span>`;

  let toastTimer;
  function toast(message, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.toggle("error", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function requireLogin() {
    if (session.token) return true;
    openAuth("login");
    return false;
  }

  // ------------------------------------------------------------------ navegação
  function renderNav() {
    const route = location.hash || "#/";
    const link = (href, label) =>
      `<a href="${href}" class="${route === href ? "active" : ""}">${label}</a>`;

    nav.innerHTML = session.user
      ? `${link("#/", "Restaurantes")}
         ${link("#/pedidos", "Meus pedidos")}
         ${link("#/painel", "Meus restaurantes")}
         <span class="user">Olá, ${esc(session.user.name.split(" ")[0])}</span>
         <button class="btn btn-sm" id="logout-btn">Sair</button>`
      : `${link("#/", "Restaurantes")}
         <button class="btn btn-sm btn-primary" id="login-btn">Entrar</button>`;

    nav.querySelector("#logout-btn")?.addEventListener("click", () => {
      window.api.setSession(null, null);
      toast("Você saiu da sua conta");
      location.hash = "#/";
      router();
    });
    nav.querySelector("#login-btn")?.addEventListener("click", () => openAuth("login"));
  }

  async function router() {
    renderNav();
    const hash = location.hash || "#/";
    const [, page, id] = hash.split("/");

    view.innerHTML = `<p class="muted">Carregando...</p>`;
    try {
      if (page === "restaurante" && id) await renderRestaurant(Number(id));
      else if (page === "pedidos") await renderOrders();
      else if (page === "painel") await renderPanel();
      else await renderHome();
    } catch (error) {
      view.innerHTML = `<div class="empty">Não foi possível carregar: ${esc(error.message)}</div>`;
    }
    view.focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ home
  async function renderHome() {
    const params = new URLSearchParams();
    if (state.search) params.set("search", state.search);
    if (state.category) params.set("category", state.category);

    const [restaurants, categories] = await Promise.all([
      window.api.get(`/restaurants?${params}`),
      window.api.get("/restaurants/categories")
    ]);

    view.innerHTML = `
      <section class="hero">
        <h1>Bateu a fome?</h1>
        <p>Escolha um restaurante, monte seu pedido e acompanhe a entrega.</p>
        <form class="search" id="search-form" role="search">
          <input name="search" placeholder="Buscar restaurante" value="${esc(state.search)}" aria-label="Buscar restaurante" />
          <button class="btn" type="submit">Buscar</button>
        </form>
      </section>
      <div class="chips" role="group" aria-label="Categorias">
        <button class="chip ${state.category ? "" : "active"}" data-category="">Todas</button>
        ${categories
          .map((c) => `<button class="chip ${state.category === c ? "active" : ""}" data-category="${esc(c)}">${esc(c)}</button>`)
          .join("")}
      </div>
      ${
        restaurants.length === 0
          ? `<div class="empty">Nenhum restaurante encontrado.</div>`
          : `<div class="grid">${restaurants.map(restaurantCard).join("")}</div>`
      }`;

    view.querySelector("#search-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.search = formData(event.target).search.trim();
      renderHome();
    });
    view.querySelectorAll("[data-category]").forEach((chip) =>
      chip.addEventListener("click", () => {
        state.category = chip.dataset.category;
        renderHome();
      })
    );
  }

  function restaurantCard(r) {
    return `
      <a class="card restaurant-card" href="#/restaurante/${r.id}">
        ${restaurantVisual(r)}
        <h3>${esc(r.name)}</h3>
        <div class="meta">
          <span class="rating">★ ${Number(r.rating).toFixed(1)}</span>
          <span>${esc(r.category)}</span>
          <span>${r.deliveryFee > 0 ? `Entrega ${money(r.deliveryFee)}` : "Entrega grátis"}</span>
        </div>
        ${r.description ? `<p class="muted">${esc(r.description)}</p>` : ""}
      </a>`;
  }

  // ------------------------------------------------------------------ restaurante + carrinho
  async function renderRestaurant(id) {
    const [restaurant, menu] = await Promise.all([
      window.api.get(`/restaurants/${id}`),
      window.api.get(`/restaurants/${id}/menu`)
    ]);

    view.innerHTML = `
      <a href="#/" class="muted">← Voltar</a>
      <div class="restaurant-header" style="margin-top:12px">
        ${restaurantVisual(restaurant)}
        <div>
          <h1>${esc(restaurant.name)}</h1>
          <div class="meta">
            <span class="rating">★ ${Number(restaurant.rating).toFixed(1)}</span>
            <span>${esc(restaurant.category)}</span>
            <span>${restaurant.deliveryFee > 0 ? `Entrega ${money(restaurant.deliveryFee)}` : "Entrega grátis"}</span>
          </div>
        </div>
      </div>
      <div class="layout-2">
        <section>
          <h2>Cardápio</h2>
          <div class="menu-list">
            ${
              menu.length === 0
                ? `<div class="empty">Este restaurante ainda não cadastrou itens.</div>`
                : menu.map(menuItemRow).join("")
            }
          </div>
        </section>
        <aside class="card cart" id="cart" aria-label="Sacola"></aside>
      </div>`;

    view.querySelectorAll("[data-add]").forEach((button) =>
      button.addEventListener("click", () => {
        const item = menu.find((m) => m.id === Number(button.dataset.add));
        addToCart(restaurant, item);
      })
    );
    renderCart(restaurant);
  }

  function menuItemRow(item) {
    return `
      <div class="card menu-item ${item.available ? "" : "unavailable"}">
        <div>
          <h3>${esc(item.name)}</h3>
          ${item.description ? `<p class="muted">${esc(item.description)}</p>` : ""}
          <span class="price">${money(item.price)}</span>
        </div>
        ${
          item.available
            ? `<button class="btn btn-sm btn-primary" data-add="${item.id}">Adicionar</button>`
            : `<span class="muted">Indisponível</span>`
        }
      </div>`;
  }

  function addToCart(restaurant, item) {
    if (cart.restaurant && cart.restaurant.id !== restaurant.id) {
      if (!confirm(`Sua sacola tem itens de ${cart.restaurant.name}. Esvaziar e começar uma nova?`)) return;
      cart.items.clear();
    }
    cart.restaurant = restaurant;
    const line = cart.items.get(item.id) || { item, quantity: 0 };
    line.quantity = Math.min(line.quantity + 1, 99);
    cart.items.set(item.id, line);
    renderCart(restaurant);
  }

  function renderCart(restaurant) {
    const el = document.getElementById("cart");
    if (!el) return;

    const isThisRestaurant = cart.restaurant && cart.restaurant.id === restaurant.id;
    const lines = isThisRestaurant ? [...cart.items.values()] : [];

    if (lines.length === 0) {
      el.innerHTML = `<h2>Sua sacola</h2><p class="muted">Adicione itens do cardápio.</p>`;
      return;
    }

    const subtotal = lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
    const fee = Number(restaurant.deliveryFee);

    el.innerHTML = `
      <h2>Sua sacola</h2>
      ${lines
        .map(
          (l) => `
        <div class="cart-line">
          <span>${esc(l.item.name)}</span>
          <span class="qty">
            <button data-dec="${l.item.id}" aria-label="Remover um">−</button>
            ${l.quantity}
            <button data-inc="${l.item.id}" aria-label="Adicionar um">+</button>
          </span>
        </div>`
        )
        .join("")}
      <div class="totals">
        <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div><span>Entrega</span><span>${fee > 0 ? money(fee) : "Grátis"}</span></div>
        <div class="grand"><span>Total</span><span>${money(subtotal + fee)}</span></div>
      </div>
      <form class="form" id="checkout-form">
        <label>Endereço de entrega <input name="deliveryAddress" required minlength="5" placeholder="Rua, número, bairro" value="${esc(checkoutDraft.deliveryAddress)}" /></label>
        <label>Observações <input name="notes" maxlength="300" placeholder="Ex.: sem cebola" value="${esc(checkoutDraft.notes)}" /></label>
        <button class="btn btn-primary btn-block" type="submit">Fazer pedido</button>
      </form>`;

    el.querySelectorAll("[data-inc]").forEach((b) =>
      b.addEventListener("click", () => {
        const line = cart.items.get(Number(b.dataset.inc));
        line.quantity = Math.min(line.quantity + 1, 99);
        renderCart(restaurant);
      })
    );
    el.querySelectorAll("[data-dec]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = Number(b.dataset.dec);
        const line = cart.items.get(id);
        line.quantity -= 1;
        if (line.quantity <= 0) cart.items.delete(id);
        renderCart(restaurant);
      })
    );
    el.querySelectorAll("#checkout-form input").forEach((input) =>
      input.addEventListener("input", () => (checkoutDraft[input.name] = input.value))
    );
    el.querySelector("#checkout-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!requireLogin()) return;
      const data = formData(event.target);
      try {
        const order = await window.api.post("/orders", {
          restaurantId: restaurant.id,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes || undefined,
          items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity }))
        });
        cart.items.clear();
        cart.restaurant = null;
        checkoutDraft.notes = "";
        toast(`Pedido #${order.id} enviado! Total ${money(order.total)}`);
        location.hash = "#/pedidos";
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  // ------------------------------------------------------------------ pedidos do cliente
  async function renderOrders() {
    if (!session.token) {
      view.innerHTML = `<div class="empty">Entre na sua conta para ver seus pedidos.</div>`;
      openAuth("login");
      return;
    }
    const orders = await window.api.get("/orders");

    view.innerHTML = `
      <h1>Meus pedidos</h1>
      ${
        orders.length === 0
          ? `<div class="empty">Você ainda não fez pedidos. <a href="#/">Ver restaurantes</a></div>`
          : `<div class="grid">${orders.map((o) => orderCard(o, { customer: true })).join("")}</div>`
      }`;

    bindOrderActions(renderOrders);
  }

  function orderCard(order, { customer = false } = {}) {
    const next = customer
      ? order.status === "PENDENTE" ? ["CANCELADO"] : []
      : RESTAURANT_NEXT[order.status] || [];

    return `
      <article class="card order">
        <div class="order-head">
          <h3>#${order.id} · ${esc(customer ? order.restaurantName : order.deliveryAddress)}</h3>
          ${badge(order.status)}
        </div>
        <span class="muted">${dateTime(order.createdAt)}</span>
        <ul class="order-items">
          ${order.items.map((i) => `<li>${i.quantity}× ${esc(i.name)} — ${money(i.unitPrice * i.quantity)}</li>`).join("")}
        </ul>
        ${order.notes ? `<p class="muted">Obs.: ${esc(order.notes)}</p>` : ""}
        <strong>Total ${money(order.total)}</strong>
        ${
          next.length
            ? `<div class="actions">${next
                .map(
                  (s) =>
                    `<button class="btn btn-sm ${s === "CANCELADO" ? "btn-danger" : "btn-primary"}" data-order="${order.id}" data-status="${s}">${ACTION_LABEL[s]}</button>`
                )
                .join("")}</div>`
            : ""
        }
      </article>`;
  }

  function bindOrderActions(refresh) {
    view.querySelectorAll("[data-order]").forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          await window.api.patch(`/orders/${button.dataset.order}/status`, { status: button.dataset.status });
          toast(`Pedido #${button.dataset.order}: ${STATUS_LABEL[button.dataset.status]}`);
          refresh();
        } catch (error) {
          toast(error.message, true);
        }
      })
    );
  }

  // ------------------------------------------------------------------ painel do dono
  async function renderPanel() {
    if (!session.token) {
      view.innerHTML = `<div class="empty">Entre na sua conta para gerenciar seus restaurantes.</div>`;
      openAuth("login");
      return;
    }
    const mine = await window.api.get("/restaurants/mine");
    if (!mine.some((r) => r.id === state.managing)) state.managing = mine[0]?.id ?? null;

    view.innerHTML = `
      <h1>Meus restaurantes</h1>
      <div class="layout-2">
        <section id="manage-area"></section>
        <aside class="card">
          <div class="panel-list">
            ${mine
              .map(
                (r) =>
                  `<button class="btn ${r.id === state.managing ? "active" : ""}" data-manage="${r.id}">${esc(r.name)}</button>`
              )
              .join("")}
          </div>
          <h2 class="section">Novo restaurante</h2>
          <form class="form" id="restaurant-form">
            <label>Nome <input name="name" required minlength="2" /></label>
            <label>Categoria <input name="category" required minlength="2" placeholder="Ex.: Pizza" /></label>
            <label>Descrição <input name="description" maxlength="500" /></label>
            <label>Taxa de entrega (R$) <input name="deliveryFee" type="number" min="0" step="0.01" value="0" /></label>
            <button class="btn btn-primary" type="submit">Cadastrar</button>
          </form>
        </aside>
      </div>`;

    view.querySelectorAll("[data-manage]").forEach((b) =>
      b.addEventListener("click", () => {
        state.managing = Number(b.dataset.manage);
        renderPanel();
      })
    );
    view.querySelector("#restaurant-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = formData(event.target);
      try {
        const created = await window.api.post("/restaurants", {
          name: data.name,
          category: data.category,
          description: data.description || undefined,
          deliveryFee: Number(data.deliveryFee || 0)
        });
        state.managing = created.id;
        toast(`${created.name} cadastrado!`);
        renderPanel();
      } catch (error) {
        toast(error.message, true);
      }
    });

    const area = view.querySelector("#manage-area");
    if (!state.managing) {
      area.innerHTML = `<div class="empty">Você ainda não tem restaurantes. Cadastre o primeiro ao lado.</div>`;
      return;
    }
    await renderManage(area, mine.find((r) => r.id === state.managing));
  }

  async function renderManage(area, current) {
    const [restaurant, menu, orders] = await Promise.all([
      window.api.get(`/restaurants/${current.id}`), // dados atualizados (inclui o status da foto)
      window.api.get(`/restaurants/${current.id}/menu`),
      window.api.get(`/restaurants/${current.id}/orders`)
    ]);
    const active = orders.filter((o) => !["ENTREGUE", "CANCELADO"].includes(o.status));

    area.innerHTML = `
      <div class="section-title">
        <h2>${esc(restaurant.name)}</h2>
        <div class="actions">
          <a class="btn btn-sm" href="#/restaurante/${restaurant.id}">Ver página</a>
          <button class="btn btn-sm btn-danger" id="delete-restaurant">Excluir</button>
        </div>
      </div>

      <div class="section card image-panel">
        ${restaurantVisual(restaurant, "avatar avatar-lg")}
        <div>
          <h3>Foto do restaurante</h3>
          <p class="muted" id="image-status">${IMAGE_STATUS_LABEL[restaurant.imageStatus] || ""}</p>
          <div class="actions">
            <label class="btn btn-sm btn-primary file-btn">
              ${restaurant.imageUrl ? "Trocar foto" : "Enviar foto"}
              <input type="file" id="image-input" accept="image/jpeg,image/png,image/webp" hidden />
            </label>
            ${restaurant.imageStatus !== "NENHUMA" ? `<button class="btn btn-sm btn-danger" id="image-remove">Remover foto</button>` : ""}
          </div>
          <p class="hint">JPEG, PNG ou WebP até 15 MB. A imagem é otimizada automaticamente (800 px, WebP).</p>
        </div>
      </div>

      <div class="section">
        <h3>Pedidos em andamento (${active.length})</h3>
        ${
          active.length
            ? `<div class="grid">${active.map((o) => orderCard(o)).join("")}</div>`
            : `<p class="muted">Nenhum pedido em andamento.</p>`
        }
      </div>

      <div class="section">
        <h3>Cardápio</h3>
        <div class="menu-list">
          ${menu
            .map(
              (item) => `
            <div class="card menu-item">
              <div>
                <strong>${esc(item.name)}</strong> · <span class="price">${money(item.price)}</span>
              </div>
              <div class="actions">
                <label class="switch"><input type="checkbox" data-toggle="${item.id}" ${item.available ? "checked" : ""}/> Disponível</label>
                <button class="btn btn-sm btn-danger" data-remove="${item.id}">Remover</button>
              </div>
            </div>`
            )
            .join("") || `<p class="muted">Nenhum item cadastrado.</p>`}
        </div>
        <form class="form card section" id="item-form">
          <h3>Novo item</h3>
          <div class="row">
            <label>Nome <input name="name" required minlength="2" /></label>
            <label>Preço (R$) <input name="price" type="number" min="0.01" step="0.01" required /></label>
          </div>
          <label>Descrição <input name="description" maxlength="500" /></label>
          <button class="btn btn-primary" type="submit">Adicionar ao cardápio</button>
        </form>
      </div>`;

    const refresh = () => renderManage(area, restaurant);
    bindOrderActions(refresh);

    area.querySelector("#image-input").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) return toast("A imagem deve ter no máximo 15 MB", true);
      const statusEl = area.querySelector("#image-status");
      try {
        statusEl.textContent = "Enviando...";
        await window.api.upload(`/restaurants/${restaurant.id}/image`, file);
        statusEl.textContent = IMAGE_STATUS_LABEL.PROCESSANDO;
        const final = await waitForImage(restaurant.id);
        toast(final === "PRONTA" ? "Foto atualizada!" : "Não foi possível processar a imagem", final !== "PRONTA");
        refresh();
      } catch (error) {
        statusEl.textContent = "";
        toast(error.message, true);
      }
    });
    area.querySelector("#image-remove")?.addEventListener("click", async () => {
      try {
        await window.api.del(`/restaurants/${restaurant.id}/image`);
        toast("Foto removida");
        refresh();
      } catch (error) {
        toast(error.message, true);
      }
    });

    area.querySelector("#delete-restaurant").addEventListener("click", async () => {
      if (!confirm(`Excluir ${restaurant.name}?`)) return;
      try {
        await window.api.del(`/restaurants/${restaurant.id}`);
        state.managing = null;
        toast("Restaurante excluído");
        renderPanel();
      } catch (error) {
        toast(error.message, true);
      }
    });
    area.querySelectorAll("[data-toggle]").forEach((input) =>
      input.addEventListener("change", async () => {
        try {
          await window.api.patch(`/restaurants/${restaurant.id}/menu/${input.dataset.toggle}`, {
            available: input.checked
          });
          toast(input.checked ? "Item disponível" : "Item indisponível");
        } catch (error) {
          input.checked = !input.checked;
          toast(error.message, true);
        }
      })
    );
    area.querySelectorAll("[data-remove]").forEach((button) =>
      button.addEventListener("click", async () => {
        try {
          await window.api.del(`/restaurants/${restaurant.id}/menu/${button.dataset.remove}`);
          toast("Item removido");
          refresh();
        } catch (error) {
          toast(error.message, true);
        }
      })
    );
    area.querySelector("#item-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = formData(event.target);
      try {
        await window.api.post(`/restaurants/${restaurant.id}/menu`, {
          name: data.name,
          price: Number(data.price),
          description: data.description || undefined
        });
        toast("Item adicionado");
        refresh();
      } catch (error) {
        toast(error.message, true);
      }
    });
  }

  // O processamento é assíncrono (função serverless): consulta o status até terminar
  async function waitForImage(restaurantId, { intervalMs = 1000, timeoutMs = 30000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const { imageStatus } = await window.api.get(`/restaurants/${restaurantId}/image/status`);
      if (imageStatus !== "PROCESSANDO") return imageStatus;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return "PROCESSANDO";
  }

  // ------------------------------------------------------------------ login / cadastro
  const dialog = document.getElementById("auth-dialog");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const authError = document.getElementById("auth-error");

  function openAuth(tab) {
    switchAuthTab(tab);
    authError.textContent = "";
    if (!dialog.open) dialog.showModal();
  }

  function switchAuthTab(tab) {
    dialog.querySelectorAll("[data-auth-tab]").forEach((b) =>
      b.classList.toggle("active", b.dataset.authTab === tab)
    );
    loginForm.hidden = tab !== "login";
    registerForm.hidden = tab !== "register";
    authError.textContent = "";
  }

  dialog.querySelectorAll("[data-auth-tab]").forEach((b) =>
    b.addEventListener("click", () => switchAuthTab(b.dataset.authTab))
  );

  async function login(email, password) {
    const result = await window.api.post("/auth/login", { email, password });
    window.api.setSession(result.token, result.user);
    dialog.close();
    toast(`Bem-vindo(a), ${result.user.name.split(" ")[0]}!`);
    router();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(loginForm);
    try {
      await login(data.email, data.password);
      loginForm.reset();
    } catch (error) {
      authError.textContent = error.message;
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formData(registerForm);
    try {
      await window.api.post("/auth/register", data);
      await login(data.email, data.password);
      registerForm.reset();
    } catch (error) {
      authError.textContent = error.message;
    }
  });

  // ------------------------------------------------------------------ início
  window.api
    .get("/health")
    .then((h) => (document.getElementById("db-status").textContent = `Banco: ${h.database}`))
    .catch(() => (document.getElementById("db-status").textContent = "Banco indisponível"));

  window.addEventListener("hashchange", router);
  router();
})();
