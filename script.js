const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessage = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = fileUploadWrapper.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closeChatbot = document.querySelector("#close-chatbot");

// =====================
// API setup
// ⚠️ ห้าม push API_KEY จริงขึ้น Git/Github เด็ดขาด
// ใส่ .env ถ้า deploy backend นะ
// =====================
const API_KEY = "AIzaSyDj_mbQ2jvWYp3H85xzwKjFRsOdQ_jG-RM";
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// เก็บสถานะของ user ตอนนี้
const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

// เก็บประวัติแชตที่จะถูกส่งกลับเข้าโมเดลทุกรอบ
// ต้องเริ่มว่าง แล้วค่อย push user / model ตามลำดับ
const chatHistory = [];

const initialInputHeight = messageInput.scrollHeight;

// helper: สร้าง div ข้อความ
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// helper: ดึงข้อความตอบจาก API ให้ปลอดภัย
function extractTextFromResponse(data) {
  try {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts || !parts.length) return JSON.stringify(data, null, 2);
    // ต่อทุก part.text ติดกัน เผื่อมีหลายช่วง
    return parts
      .map(p => p.text || "")
      .join("\n")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .trim();
  } catch {
    return JSON.stringify(data, null, 2);
  }
}

function typeTextEffect(element, text, speed = 30) {
  let index = 0;
  const interval = setInterval(() => {
    element.textContent += text.charAt(index);
    index++;
    if (index >= text.length) clearInterval(interval);
  }, speed);
}

// เรียก Gemini API
const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  // push user message (พร้อมรูปถ้ามี) เข้า history ก่อนเรียก API
  chatHistory.push({
    role: "user",
    parts: [
      { text: userData.message },
      ...(userData.file.data
        ? [{ inline_data: userData.file }]
        : []),
    ],
  });

  // เตรียม payload: contents = บทสนทนาทั้งหมดจนถึงตอนนี้
  const requestBody = {
    contents: chatHistory,
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "API Error");

    // ดึงข้อความตอบ
    const botText = extractTextFromResponse(data);

    // แสดงใน UI
    messageElement.innerText = "";
typeTextEffect(messageElement, botText, 15);

    // เก็บคำตอบบอทกลับเข้า history ด้วย
    chatHistory.push({
      role: "model",
      parts: [{ text: botText }],
    });
  } catch (error) {
    console.log(error);
    messageElement.innerText = error.message;
    messageElement.style.color = "#ff0000";
  } finally {
    // reset file
    userData.file = {};
    incomingMessageDiv.classList.remove("thinking");
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
};

// จัดการข้อความขาออก (ฝั่งพี่)
const handleOutgoingMessage = (e) => {
  e.preventDefault();

  userData.message = messageInput.value.trim();
  if (!userData.message && !userData.file?.data) return; // กันกดส่งว่างๆ

  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input"));

  fileUploadWrapper.classList.remove("file-uploaded");

  // DOM ของข้อความฝั่ง user
  const messageContent = `
    <div class="message-text"></div>
    ${
      userData.file.data
        ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment" />`
        : ""
    }`;

  const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
  outgoingMessageDiv.querySelector(".message-text").innerText = userData.message;
  chatBody.appendChild(outgoingMessageDiv);
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

  // สร้าง bubble ตอบของบอท พร้อมจุดกระพริบ
  setTimeout(() => {
    const botBubble = `
      <img src="images/Up-ChatLOGO.png" class="chatbot-logo" width="50" height="40">
      <div class="message-text">
        <div class="thinking-indicator">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>`;

    const incomingMessageDiv = createMessageElement(botBubble, "bot-message", "thinking");
    chatBody.appendChild(incomingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

    // ยิง API
    generateBotResponse(incomingMessageDiv);
  }, 600);
};

// textarea auto-resize
messageInput.addEventListener("input", () => {
  messageInput.style.height = `${initialInputHeight}px`;
  messageInput.style.height = `${messageInput.scrollHeight}px`;

  document.querySelector(".chat-form").style.borderRadius =
    messageInput.scrollHeight > initialInputHeight ? "15px" : "32px";
});

// Enter = ส่ง (ถ้าไม่ได้กด shift และไม่ได้บนจอเล็ก)
messageInput.addEventListener("keydown", (e) => {
  const userMessage = e.target.value.trim();
  if (e.key === "Enter" && !e.shiftKey && (userMessage || userData.file?.data) && window.innerWidth > 768) {
    handleOutgoingMessage(e);
  }
});

// อัปโหลดไฟล์รูป
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    fileInput.value = "";
    fileUploadWrapper.querySelector("img").src = e.target.result;
    fileUploadWrapper.classList.add("file-uploaded");

    const base64String = e.target.result.split(",")[1];

    userData.file = {
      data: base64String,
      mime_type: file.type,
    };
  };

  reader.readAsDataURL(file);
});

// ยกเลิกไฟล์
fileCancelButton.addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-uploaded");
});

// emoji picker
const picker = new EmojiMart.Picker({
  theme: "light",
  skinTonePosition: "none",
  previewPosition: "none",
  onEmojiSelect: (emoji) => {
    const { selectionStart: start, selectionEnd: end } = messageInput;
    messageInput.setRangeText(emoji.native, start, end, "end");
    messageInput.focus();
  },
  onClickOutside: (e) => {
    if (e.target.id === "emoji-picker") {
      document.body.classList.toggle("show-emoji-picker");
    } else {
      document.body.classList.remove("show-emoji-picker");
    }
  },
});

document.querySelector(".chat-form").appendChild(picker);

// ปุ่มกดส่ง / ปุ่มแนบ / ปุ่มปิด-เปิดแชต
sendMessage.addEventListener("click", (e) => handleOutgoingMessage(e));
document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
closeChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));





