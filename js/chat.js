import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
    model: "gpt-5.4",
    input: "Eres un psicologo especializado en trastornos de ansiedad."
});
