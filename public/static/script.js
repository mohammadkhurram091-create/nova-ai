
/* =========================================
   NOVA AI — MAIN JAVASCRIPT
   ========================================= */

/* ---------- DOM ELEMENTS ---------- */

const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome-screen");
const sendButton = document.getElementById("send-button");
const newChatButton = document.getElementById("new-chat");
const historyList = document.getElementById("history-list");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("mobile-overlay");
const openSidebarButton = document.getElementById("open-sidebar");
const closeSidebarButton = document.getElementById("close-sidebar");
const themeToggle = document.getElementById("theme-toggle");

/* ---------- APPLICATION STATE ---------- */

const CHAT_STORAGE_KEY = "nova-conversations";
const THEME_STORAGE_KEY = "nova-theme";

let conversations = [];
let currentConversationId = null;
let isSending = false;


/* =========================================
   THEME MANAGEMENT
   ========================================= */

function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", selectedTheme);

    if (themeToggle) {
        themeToggle.setAttribute(
            "aria-label",
            selectedTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
        );
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch (error) {
        console.error("Could not save theme:", error);
    }
}

function initializeTheme() {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        applyTheme(savedTheme || "light");
    } catch (error) {
        applyTheme("light");
    }

    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
        const currentTheme =
            document.documentElement.getAttribute("data-theme");

        applyTheme(currentTheme === "dark" ? "light" : "dark");
    });
}


/* =========================================
   CHAT STORAGE
   ========================================= */

function saveConversations() {
    try {
        localStorage.setItem(
            CHAT_STORAGE_KEY,
            JSON.stringify({
                conversations,
                currentConversationId
            })
        );
    } catch (error) {
        console.error("Could not save conversations:", error);
    }
}

function loadConversations() {
    try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);

        if (!saved) return;

        const data = JSON.parse(saved);

        if (!data || !Array.isArray(data.conversations)) return;

        conversations = data.conversations.filter(chat =>
            chat &&
            typeof chat.id === "string" &&
            typeof chat.title === "string" &&
            Array.isArray(chat.messages)
        );

        currentConversationId = data.currentConversationId;

        if (!conversations.some(
            chat => chat.id === currentConversationId
        )) {
            currentConversationId = null;
        }
    } catch (error) {
        console.error("Could not load conversations:", error);

        conversations = [];
        currentConversationId = null;
    }
}


/* =========================================
   CONVERSATION MANAGEMENT
   ========================================= */

function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentConversation() {
    return conversations.find(
        chat => chat.id === currentConversationId
    );
}

function createConversation() {
    const chat = {
        id: makeId(),
        title: "New conversation",
        messages: []
    };

    conversations.unshift(chat);
    currentConversationId = chat.id;

    saveConversations();
    renderHistory();

    return chat;
}

function ensureConversation() {
    return getCurrentConversation() || createConversation();
}

function startNewChat() {
    if (isSending) return;

    currentConversationId = null;

    showWelcomeView();
    renderHistory();

    input.value = "";
    resizeInput();
    input.focus();

    closeSidebar();

    saveConversations();
}


/* =========================================
   HTML ESCAPING & MESSAGE FORMATTING
   ========================================= */

function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatMessage(text) {
    const codeBlocks = [];

    let safe = escapeHTML(text);

    safe = safe.replace(
        /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g,
        (_, language, code) => {
            const index = codeBlocks.length;

            codeBlocks.push(
                `<pre><code>${code.trimEnd()}</code></pre>`
            );

            return `%%CODEBLOCK${index}%%`;
        }
    );

    safe = safe.replace(
        /`([^`\n]+)`/g,
        "<code>$1</code>"
    );

    safe = safe.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /\*(.+?)\*/g,
        "<em>$1</em>"
    );

    safe = safe.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    safe = safe.replace(
        /^### (.+)$/gm,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /^## (.+)$/gm,
        "<strong>$1</strong>"
    );

    safe = safe.replace(
        /^# (.+)$/gm,
        "<strong>$1</strong>"
    );

    const lines = safe.split("\n");
    const formattedLines = [];

    let inList = false;

    for (const line of lines) {
        const item = line.match(/^\s*[-*]\s+(.+)$/);

        if (item) {
            if (!inList) {
                formattedLines.push("<ul>");
                inList = true;
            }

            formattedLines.push(`<li>${item[1]}</li>`);
        } else {
            if (inList) {
                formattedLines.push("</ul>");
                inList = false;
            }

            formattedLines.push(
                line.trim()
                    ? `<p>${line}</p>`
                    : "<br>"
            );
        }
    }

    if (inList) {
        formattedLines.push("</ul>");
    }

    safe = formattedLines.join("");

    safe = safe.replace(
        /%%CODEBLOCK(\d+)%%/g,
        (_, index) => codeBlocks[Number(index)] || ""
    );

    return safe;
}


/* =========================================
   CHAT VIEW MANAGEMENT
   ========================================= */

function showChatView() {
    welcome.style.display = "none";
    messages.classList.add("visible");
}

function showWelcomeView() {
    welcome.style.display = "";
    messages.classList.remove("visible");
    messages.replaceChildren();
}

function scrollToBottom() {
    const chatArea = document.getElementById("chat-area");

    if (chatArea) {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}


/* =========================================
   MESSAGE RENDERING
   ========================================= */

function addMessage(role, text, options = {}) {
    showChatView();

    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "K" : "✦";
    avatar.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "message-content";

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const name = document.createElement("strong");
    name.textContent = role === "user" ? "You" : "Nova AI";

    meta.appendChild(name);

    const time = document.createElement("span");
    time.textContent = options.time || "Just now";

    meta.appendChild(time);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if (options.typing) {
        const typing = document.createElement("div");

        typing.className = "typing-indicator";
        typing.setAttribute("aria-label", "Nova is thinking");

        for (let i = 0; i < 3; i++) {
            typing.appendChild(document.createElement("span"));
        }

        bubble.appendChild(typing);
    } else if (options.error) {
        bubble.classList.add("error");
        bubble.textContent = text;
    } else {
        bubble.innerHTML = formatMessage(text);
    }

    content.append(meta, bubble);
    row.append(avatar, content);

    messages.appendChild(row);

    scrollToBottom();

    return { row, bubble };
}


/* =========================================
   RENDER CONVERSATION
   ========================================= */

function renderConversation(chat) {
    if (!chat) return;

    currentConversationId = chat.id;

    showChatView();
    messages.replaceChildren();

    for (const message of chat.messages) {
        addMessage(message.role, message.content, {
            time: message.time
        });
    }

    renderHistory();
    saveConversations();
    scrollToBottom();
}


/* =========================================
   CHAT HISTORY SIDEBAR
   ========================================= */

function renderHistory() {
    historyList.replaceChildren();

    if (conversations.length === 0) {
        const empty = document.createElement("div");

        empty.className = "empty-history";
        empty.textContent = "Your conversations will appear here.";

        historyList.appendChild(empty);

        return;
    }

    for (const chat of conversations) {
        const button = document.createElement("button");

        button.className = "history-item";
        button.type = "button";

        if (chat.id === currentConversationId) {
            button.classList.add("active");
        }

        const symbol = document.createElement("span");

        symbol.className = "history-symbol";
        symbol.textContent = "◌";

        const title = document.createElement("span");

        title.className = "history-title";
        title.textContent = chat.title;

        button.append(symbol, title);

        button.addEventListener("click", () => {
            if (isSending) return;

            renderConversation(chat);
            closeSidebar();
        });

        historyList.appendChild(button);
    }
}


/* =========================================
   SIDEBAR CONTROLS
   ========================================= */

function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("visible");
}

function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("visible");
}


/* =========================================
   SEND MESSAGE — FLASK + OLLAMA
   ========================================= */

async function sendMessage(rawMessage) {
    const message = rawMessage.trim();

    if (!message || isSending) return;

    const chat = ensureConversation();

    if (chat.messages.length === 0) {
        chat.title = message.length > 34
            ? `${message.slice(0, 34)}…`
            : message;
    }

    chat.messages.push({
        role: "user",
        content: message,
        time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })
    });

    saveConversations();
    renderConversation(chat);

    input.value = "";
    resizeInput();

    isSending = true;

    sendButton.disabled = true;
    input.disabled = true;

    const thinkingMessage = addMessage("assistant", "", {
        typing: true
    });

    try {
        const response = await fetch("/chat", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({ message })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error || `Request failed (${response.status}).`
            );
        }

        if (typeof data.reply !== "string") {
            throw new Error(
                "The server returned an unexpected response."
            );
        }

        chat.messages.push({
            role: "assistant",
            content: data.reply,
            time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            })
        });

        saveConversations();

        thinkingMessage.row.remove();

        addMessage("assistant", data.reply);

    } catch (error) {
        thinkingMessage.row.remove();

        const errorText =
            error.message === "Failed to fetch"
                ? "Cannot connect to the Flask server. Check that the server is running and Ollama is available."
                : error.message;

        addMessage("assistant", errorText, {
            error: true
        });

    } finally {
        isSending = false;

        sendButton.disabled = false;
        input.disabled = false;

        input.focus();

        renderHistory();
        scrollToBottom();
    }
}


/* =========================================
   INPUT RESIZING
   ========================================= */

function resizeInput() {
    input.style.height = "auto";

    input.style.height = `${Math.min(
        input.scrollHeight,
        150
    )}px`;
}


/* =========================================
   EVENT LISTENERS
   ========================================= */

// Submit message
form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input.value);
});

// Resize textarea
input.addEventListener("input", resizeInput);

// Enter to send, Shift + Enter for newline
input.addEventListener("keydown", event => {
    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
    ) {
        event.preventDefault();
        form.requestSubmit();
    }
});

// Prompt suggestions
document.querySelectorAll("[data-prompt]").forEach(button => {
    button.addEventListener("click", () => {
        if (isSending) return;

        input.value = button.dataset.prompt || "";

        resizeInput();
        sendMessage(input.value);
    });
});

// New chat
newChatButton.addEventListener("click", startNewChat);

// Mobile sidebar
openSidebarButton.addEventListener("click", openSidebar);
closeSidebarButton.addEventListener("click", closeSidebar);
overlay.addEventListener("click", closeSidebar);

// Keyboard shortcuts
document.addEventListener("keydown", event => {
    if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
    ) {
        event.preventDefault();
        startNewChat();
    }

    if (event.key === "Escape") {
        closeSidebar();
    }
});


/* =========================================
   APPLICATION INITIALIZATION
   ========================================= */

function initializeNova() {
    initializeTheme();

    loadConversations();
    renderHistory();

    if (currentConversationId) {
        const currentChat = getCurrentConversation();

        if (currentChat) {
            renderConversation(currentChat);
        }
    }
}

initializeNova();
