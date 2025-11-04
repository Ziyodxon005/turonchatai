const messagesDiv = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

const BACKEND_URL = "/api/chat";

function addMessage(text, sender){
  const div = document.createElement("div");
  div.className = "message " + sender;
  div.textContent = text;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage(){
  const message = userInput.value.trim();
  if(!message) return;
  addMessage("Siz: " + message, "user");
  userInput.value = "";

  addMessage("Bot javob yozmoqda...", "bot");

  try{
    const response = await fetch(BACKEND_URL, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();

    console.log(data);
    messagesDiv.lastChild.textContent = "Bot: " + (data.reply || "Javob topilmadi");
  }catch(err){
    messagesDiv.lastChild.textContent = "Xato: " + err.message;
  }
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", e=>{
  if(e.key==="Enter") sendMessage();
});



