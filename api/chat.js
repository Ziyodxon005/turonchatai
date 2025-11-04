const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION; // mpt-7b-chat model version ID

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ error:"Only POST requests allowed" });

  const { message } = req.body;
  const prompt = `Siz Turon O'quv Markazi chatbotisiz. Faqat o'quv markazi haqidagi savollarga javob bering: "${message}"`;

  try{
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method:"POST",
      headers:{
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input:{ prompt, max_new_tokens:256, temperature:0.2 }
      })
    });

    const data = await response.json();
    res.status(200).json({ reply: data.output ? data.output.join(" ") : "Javob topilmadi" });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
}
