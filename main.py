from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import graph_engine
import image_service

app = FastAPI(title="Shape Designer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DesignRequest(BaseModel):
    vertices: int
    edges: int
    requireEulerian: bool
    requireHamiltonian: bool
    category: str
    description: str = ""
    curveType: str = "cube"
    enableImage: bool = False
    imageQuality: str = "standard"
    imageStyle: str = "natural"
    imagePrompt: str = ""

@app.post("/api/generate")
def generate_design_endpoint(req: DesignRequest):
    result = graph_engine.generate_design(
        req.vertices, 
        req.edges, 
        req.requireEulerian, 
        req.requireHamiltonian,
        req.description,
        req.curveType,
        req.category,
    )
    if result.get("valid") and req.enableImage:
        prompt = image_service.build_prompt(result, req.imagePrompt, req.imageStyle)
        result["image_prompt"] = prompt
        result["image"] = image_service.generate_dalle3_image(
            prompt=prompt,
            quality=req.imageQuality,
            style=req.imageStyle,
        )
    return result

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
