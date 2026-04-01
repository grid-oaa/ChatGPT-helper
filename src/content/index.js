(function initApp(global) {
  const NAMESPACE = "__CHATGPT_HELPER__";
  const state = (global[NAMESPACE] = global[NAMESPACE] || {});

  if (state.appInitialized) {
    return;
  }

  const domAdapter = state.domAdapter;
  const sidebarApi = state.sidebar;

  if (!domAdapter || !sidebarApi) {
    return;
  }

  state.appInitialized = true;

  let sidebar = null;
  let items = [];
  let activeId = null;
  let currentPath = window.location.pathname;
  let stopObserving = () => {};
  let scrollTicking = false;
  let refreshTimer = 0;
  let currentScrollContainer = null;
  let activeLockId = null;
  let activeLockDeadline = 0;

  function ensureSidebar() {
    if (!sidebar) {
      sidebar = sidebarApi.mount(document.body, {
        onSelect(item) {
          lockActive(item.id);
          domAdapter.scrollToQuestion(item.id);
          setActive(item.id);
        }
      });
    }

    return sidebar;
  }

  function setActive(id) {
    activeId = id || null;
    sidebar?.setActive(activeId);
  }

  function getItemById(id) {
    return items.find((item) => item.id === id) || null;
  }

  function isLockedTargetSettled() {
    if (!activeLockId) {
      return true;
    }

    const targetItem = getItemById(activeLockId);
    if (!targetItem?.element) {
      return true;
    }

    const rect = targetItem.element.getBoundingClientRect();
    const threshold = 160;
    return Math.abs(rect.top - threshold) <= 36;
  }

  function releaseActiveLock() {
    activeLockId = null;
    activeLockDeadline = 0;
  }

  function lockActive(id, duration = 2000) {
    activeLockId = id || null;
    activeLockDeadline = Date.now() + duration;
  }

  function pickActiveQuestion() {
    if (!items.length) {
      return null;
    }

    const threshold = 160;
    let best = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    items.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      const distance = Math.abs(rect.top - threshold);

      if (rect.bottom < threshold - 24) {
        return;
      }

      if (distance < nearestDistance) {
        nearestDistance = distance;
        best = item;
      }
    });

    return best || items[items.length - 1];
  }

  function render() {
    const view = ensureSidebar();
    view.render(items, activeId);
  }

  function bindScrollContainer() {
    const nextContainer = domAdapter.getScrollContainer?.() || null;
    if (currentScrollContainer === nextContainer) {
      return;
    }

    if (currentScrollContainer) {
      currentScrollContainer.removeEventListener("scroll", handleScroll);
    }

    currentScrollContainer = nextContainer;

    if (currentScrollContainer) {
      currentScrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    }
  }

  function refreshQuestions(nextItems) {
    items = Array.isArray(nextItems) ? nextItems : domAdapter.getQuestionItems();

    if (!domAdapter.isConversationRoute()) {
      items = [];
    }

    bindScrollContainer();
    if (activeLockId) {
      if (isLockedTargetSettled() || Date.now() >= activeLockDeadline) {
        releaseActiveLock();
      } else {
        setActive(activeLockId);
        render();
        return;
      }
    }

    const active = pickActiveQuestion();
    setActive(active?.id || null);
    render();
  }

  function handleScroll() {
    if (scrollTicking) {
      return;
    }

    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      if (activeLockId) {
        if (isLockedTargetSettled() || Date.now() >= activeLockDeadline) {
          releaseActiveLock();
        } else {
          setActive(activeLockId);
          return;
        }
      }

      const active = pickActiveQuestion();
      setActive(active?.id || null);
    });
  }

  function restartObserver() {
    stopObserving();
    stopObserving = domAdapter.observeQuestions((nextItems) => {
      refreshQuestions(nextItems);
    });
  }

  function handleRouteChange() {
    if (window.location.pathname === currentPath) {
      return;
    }

    currentPath = window.location.pathname;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      restartObserver();
      refreshQuestions();
    }, 120);
  }

  function patchHistory() {
    const methods = ["pushState", "replaceState"];
    methods.forEach((method) => {
      const original = history[method];
      if (typeof original !== "function") {
        return;
      }

      history[method] = function patchedHistoryState() {
        const result = original.apply(this, arguments);
        handleRouteChange();
        return result;
      };
    });
  }

  patchHistory();
  restartObserver();
  refreshQuestions();
  window.setTimeout(() => refreshQuestions(), 600);
  window.setTimeout(() => refreshQuestions(), 1800);

  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleScroll, { passive: true });
  window.addEventListener("popstate", handleRouteChange);
  window.setInterval(handleRouteChange, 1000);
})(globalThis);
