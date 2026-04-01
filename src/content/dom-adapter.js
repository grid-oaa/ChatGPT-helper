(function initDomAdapter(global) {
  const NAMESPACE = "__CHATGPT_HELPER__";
  const ITEM_ID_PREFIX = "chatgpt-helper-question";
  const USER_SELECTORS = [
    "[data-message-author-role='user']",
    "[data-testid*='user-message']",
    "[data-testid*='conversation-turn-'][data-message-author-role='user']",
    "article [data-message-author-role='user']"
  ];
  const ROUTE_PATTERN = /^\/c\/[^/]+/i;

  function isConversationRoute() {
    return ROUTE_PATTERN.test(window.location.pathname);
  }

  function getConversationRoot() {
    return document.querySelector("main");
  }

  function normalizeTitle(rawText) {
    const firstLine = (rawText || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    if (!firstLine) {
      return "未命名问题";
    }

    return firstLine
      .replace(/^(你说|您说|你问|用户|You said|You)\s*[:：]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "未命名问题";
  }

  function findTurnContainer(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }

    return (
      node.closest("article") ||
      node.closest("[data-testid^='conversation-turn-']") ||
      node.closest("[data-message-id]") ||
      node
    );
  }

  function getTextLength(element) {
    return (element?.innerText || "").replace(/\s+/g, "").length;
  }

  function looksLikeUserTurn(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const directRole = element.matches?.("[data-message-author-role='user']");
    const nestedRole = element.querySelector?.("[data-message-author-role='user']");
    const editButton = element.querySelector?.(
      "button[aria-label*='Edit'], button[aria-label*='编辑'], button[data-testid*='edit']"
    );
    const branchButton = element.querySelector?.(
      "button[aria-label*='Branch'], button[aria-label*='分支']"
    );
    const textLength = getTextLength(element);

    return Boolean(directRole || nestedRole || editButton || branchButton) && textLength > 0;
  }

  function getPrimaryCandidates(root) {
    const nodes = USER_SELECTORS.flatMap((selector) =>
      Array.from(root.querySelectorAll(selector))
    );

    return nodes
      .map(findTurnContainer)
      .filter(Boolean);
  }

  function getFallbackCandidates(root) {
    return Array.from(root.querySelectorAll("article")).filter((article) => {
      return looksLikeUserTurn(article);
    });
  }

  function getHeuristicCandidates(root) {
    const candidates = Array.from(
      root.querySelectorAll("[data-testid^='conversation-turn-'], [data-message-id], article, section")
    );

    return candidates.filter((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (element.closest(".chatgpt-helper-sidebar")) {
        return false;
      }

      if (!looksLikeUserTurn(element)) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.height > 24 && rect.width > 120;
    });
  }

  function dedupeElements(elements) {
    const seen = new Set();
    const deduped = [];

    elements.forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      if (seen.has(element)) {
        return;
      }

      seen.add(element);
      deduped.push(element);
    });

    return deduped;
  }

  function extractQuestionText(element) {
    if (!(element instanceof HTMLElement)) {
      return "";
    }

    const contentSelectors = [
      "[data-message-author-role='user'] .whitespace-pre-wrap",
      "[data-message-author-role='user'] [data-testid='user-message']",
      "[data-message-author-role='user'] [dir='auto']",
      "[data-message-author-role='user'] .markdown",
      "[data-message-author-role='user'] p",
      "[data-testid*='user-message'] .whitespace-pre-wrap",
      "[data-testid*='user-message'] [dir='auto']",
      "[data-testid*='user-message'] .markdown",
      "[data-testid*='conversation-turn-'] [dir='auto']"
    ];

    for (const selector of contentSelectors) {
      const matched = Array.from(element.querySelectorAll(selector))
        .map((node) => node.textContent?.trim() || "")
        .find((text) => text && !/^(你说|您说|你问|用户|You said|You)\s*[:：]?$/i.test(text));

      if (matched) {
        return matched;
      }
    }

    const cleanedLines = (element.innerText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(你说|您说|你问|用户|You said|You)\s*[:：]?$/i.test(line))
      .filter((line) => !/^(编辑消息|Edit message|复制|Copy|赞|踩|重新生成|Regenerate)$/i.test(line));

    return cleanedLines[0] || "";
  }

  function buildQuestionItems() {
    if (!isConversationRoute()) {
      return [];
    }

    const root = getConversationRoot();
    if (!root) {
      return [];
    }

    const primary = getPrimaryCandidates(root);
    const fallback = primary.length ? [] : getFallbackCandidates(root);
    const heuristic = primary.length || fallback.length ? [] : getHeuristicCandidates(root);
    const candidates = dedupeElements(primary.length ? primary : fallback.length ? fallback : heuristic);

    return candidates
      .map((element, index) => {
        const id = `${ITEM_ID_PREFIX}-${index + 1}`;
        element.dataset.chatgptHelperQuestionId = id;

        return {
          id,
          title: normalizeTitle(extractQuestionText(element)),
          element,
          index
        };
      })
      .filter((item) => item.title);
  }

  function getQuestionItems() {
    return buildQuestionItems();
  }

  function isScrollable(element) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight + 24;
  }

  function findScrollContainer(element) {
    let current = element?.parentElement || null;

    while (current && current !== document.body) {
      if (isScrollable(current)) {
        return current;
      }

      current = current.parentElement;
    }

    const fallback = document.scrollingElement;
    return fallback instanceof HTMLElement ? fallback : null;
  }

  function getScrollContainer() {
    const root = getConversationRoot();
    if (root instanceof HTMLElement) {
      const container = findScrollContainer(root);
      if (container) {
        return container;
      }
    }

    const firstQuestion = getQuestionItems()[0];
    if (firstQuestion?.element) {
      return findScrollContainer(firstQuestion.element);
    }

    const fallback = document.scrollingElement;
    return fallback instanceof HTMLElement ? fallback : null;
  }

  function scrollToQuestion(id) {
    const target = document.querySelector(
      `[data-chatgpt-helper-question-id='${CSS.escape(id)}']`
    );

    if (!target) {
      return false;
    }

    const container = findScrollContainer(target);

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });

    const topOffset = 96;
    if (container && container !== document.body && container !== document.documentElement) {
      window.setTimeout(() => {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const delta = targetRect.top - containerRect.top - topOffset;

        container.scrollTo({
          top: Math.max(container.scrollTop + delta, 0),
          behavior: "smooth"
        });
      }, 80);
    } else {
      window.setTimeout(() => {
        const targetTop = target.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({
          top: Math.max(targetTop, 0),
          behavior: "smooth"
        });
      }, 80);
    }

    return true;
  }

  function observeQuestions(onChange) {
    const root = getConversationRoot() || document.body;
    if (!root || typeof onChange !== "function") {
      return () => {};
    }

    let frameId = 0;
    let lastSignature = getQuestionItems()
      .map((item) => `${item.id}:${item.title}`)
      .join("|");

    const observer = new MutationObserver(() => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = 0;
        const nextItems = getQuestionItems();
        const nextSignature = nextItems
          .map((item) => `${item.id}:${item.title}`)
          .join("|");

        if (nextSignature === lastSignature) {
          return;
        }

        lastSignature = nextSignature;
        onChange(nextItems);
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      observer.disconnect();
    };
  }

  global[NAMESPACE] = global[NAMESPACE] || {};
  global[NAMESPACE].domAdapter = {
    getQuestionItems,
    getScrollContainer,
    observeQuestions,
    scrollToQuestion,
    isConversationRoute
  };
})(globalThis);
