import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CareInstructions {
  commonName: string;
  scientificName: string;
  description: string;
  watering: string;
  sunlight: string;
  soil: string;
  temperature: string;
  toxicity: string;
  difficulty: "Beginner" | "Intermediate" | "Expert";
  tips: string[];
}

export async function identifyPlant(base64Image: string): Promise<CareInstructions> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: "Identify this plant and provide detailed care instructions. Respond ONLY in JSON format following the schema provided.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          commonName: { type: Type.STRING },
          scientificName: { type: Type.STRING },
          description: { type: Type.STRING },
          watering: { type: Type.STRING },
          sunlight: { type: Type.STRING },
          soil: { type: Type.STRING },
          temperature: { type: Type.STRING },
          toxicity: { type: Type.STRING },
          difficulty: { 
            type: Type.STRING,
            enum: ["Beginner", "Intermediate", "Expert"]
          },
          tips: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: [
          "commonName", 
          "scientificName", 
          "description", 
          "watering", 
          "sunlight", 
          "soil", 
          "temperature", 
          "toxicity", 
          "difficulty", 
          "tips"
        ]
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as CareInstructions;
}
