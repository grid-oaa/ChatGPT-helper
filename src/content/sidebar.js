(function initSidebar(global) {
  const NAMESPACE = "__CHATGPT_HELPER__";
  const MAX_RAIL_MARKERS = 12;

  class QuestionSidebar {
    constructor(options = {}) {
      this.options = options;
      this.items = [];
      this.activeId = null;
      this.expanded = false;
      this.root = null;
      this.rail = null;
      this.card = null;
      this.list = null;
      this.empty = null;
      this.railSegments = [];
    }

    mount(container) {
      if (this.root) {
        return this;
      }

      const root = document.createElement("aside");
      root.className = "chatgpt-helper-sidebar";
      root.setAttribute("aria-label", "问题目录");

      const hotspot = document.createElement("div");
      hotspot.className = "chatgpt-helper-sidebar__hotspot";
      hotspot.setAttribute("aria-hidden", "true");

      const rail = document.createElement("div");
      rail.className = "chatgpt-helper-sidebar__rail";

      const card = document.createElement("div");
      card.className = "chatgpt-helper-sidebar__card";

      const list = document.createElement("div");
      list.className = "chatgpt-helper-sidebar__list";

      const empty = document.createElement("div");
      empty.className = "chatgpt-helper-sidebar__empty";
      empty.textContent = "当前会话暂无可索引问题";

      card.appendChild(list);
      card.appendChild(empty);
      root.appendChild(hotspot);
      root.appendChild(rail);
      root.appendChild(card);
      container.appendChild(root);

      rail.addEventListener("mouseenter", () => {
        this.setExpanded(true);
      });

      rail.addEventListener("mouseleave", (event) => {
        if (!card.contains(event.relatedTarget)) {
          this.setExpanded(false);
        }
      });

      card.addEventListener("mouseenter", () => {
        this.setExpanded(true);
      });

      card.addEventListener("mouseleave", (event) => {
        if (!rail.contains(event.relatedTarget)) {
          this.setExpanded(false);
        }
      });

      root.addEventListener("mouseleave", () => {
        this.setExpanded(false);
      });

      this.root = root;
      this.rail = rail;
      this.card = card;
      this.list = list;
      this.empty = empty;
      this.setExpanded(false);

      return this;
    }

    setExpanded(expanded) {
      this.expanded = Boolean(expanded);

      if (this.root) {
        this.root.dataset.expanded = this.expanded ? "true" : "false";
      }
    }

    buildRailSegments() {
      const total = this.items.length;
      if (!total) {
        return [];
      }

      const markerCount = Math.min(total, MAX_RAIL_MARKERS);
      const segmentSize = Math.ceil(total / markerCount);
      const segments = [];

      for (let markerIndex = 0; markerIndex < markerCount; markerIndex += 1) {
        const start = markerIndex * segmentSize;
        const end = Math.min(start + segmentSize - 1, total - 1);
        const item = this.items[start];

        if (!item) {
          continue;
        }

        segments.push({
          start,
          end,
          item
        });
      }

      return segments;
    }

    render(items, activeId) {
      if (!this.root || !this.rail || !this.list || !this.empty) {
        return;
      }

      this.items = Array.isArray(items) ? items.slice() : [];
      this.activeId = activeId || null;
      this.railSegments = this.buildRailSegments();
      this.rail.replaceChildren();
      this.list.replaceChildren();

      if (!this.items.length) {
        this.root.dataset.visible = "false";
        this.empty.hidden = false;
        return;
      }

      this.root.dataset.visible = "true";
      this.empty.hidden = true;

      const fragment = document.createDocumentFragment();
      this.items.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chatgpt-helper-sidebar__item";
        button.dataset.questionId = item.id;
        button.title = item.title;
        button.textContent = item.title;
        button.addEventListener("click", () => {
          this.options.onSelect?.(item);
        });
        fragment.appendChild(button);
      });

      const railFragment = document.createDocumentFragment();
      this.railSegments.forEach((segment) => {
        const railButton = document.createElement("button");
        railButton.type = "button";
        railButton.className = "chatgpt-helper-sidebar__rail-item";
        railButton.dataset.segmentStart = String(segment.start);
        railButton.dataset.segmentEnd = String(segment.end);
        railButton.dataset.questionId = segment.item.id;
        railButton.title = segment.item.title;
        railButton.setAttribute("aria-label", segment.item.title);
        railButton.addEventListener("click", () => {
          this.options.onSelect?.(segment.item);
        });
        railFragment.appendChild(railButton);
      });

      this.rail.appendChild(railFragment);
      this.list.appendChild(fragment);
      this.setActive(this.activeId);
    }

    setActive(id) {
      this.activeId = id || null;

      if (!this.list) {
        return;
      }

      const buttons = Array.from(this.list.querySelectorAll("[data-question-id]"));
      buttons.forEach((button) => {
        const isActive = button.dataset.questionId === this.activeId;
        button.classList.toggle("is-active", isActive);

        if (isActive) {
          button.scrollIntoView({
            block: "nearest"
          });
        }
      });

      if (!this.rail) {
        return;
      }

      const activeIndex = this.items.findIndex((item) => item.id === this.activeId);
      const railButtons = Array.from(this.rail.querySelectorAll("[data-question-id]"));
      railButtons.forEach((button, index) => {
        const segment = this.railSegments[index];
        const isActive =
          activeIndex >= 0 &&
          Boolean(segment) &&
          activeIndex >= segment.start &&
          activeIndex <= segment.end;

        button.classList.toggle("is-active", isActive);
      });
    }
  }

  function mount(container, options) {
    const sidebar = new QuestionSidebar(options);
    return sidebar.mount(container);
  }

  global[NAMESPACE] = global[NAMESPACE] || {};
  global[NAMESPACE].sidebar = {
    mount
  };
})(globalThis);
