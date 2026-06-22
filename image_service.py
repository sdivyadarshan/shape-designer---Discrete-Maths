import json
import os
from pathlib import Path
from urllib import error, request


OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations"


def load_local_env():
    base_dir = Path(__file__).resolve().parent
    candidates = [
        base_dir / ".env.local",
        base_dir / ".env",
        base_dir.parent / ".env.local",
        base_dir.parent / ".env",
    ]
    for path in candidates:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            clean = line.strip()
            if not clean or clean.startswith("#") or "=" not in clean:
                continue
            key, value = clean.split("=", 1)
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip('"').strip("'")


def build_prompt(graph_result, user_prompt="", style="natural"):
    shape = graph_result.get("shape", {})
    properties = graph_result.get("properties", {})
    label = shape.get("label", "custom graph")
    category = shape.get("category", "concept design")
    base_prompt = (
        f"Create a polished AI-generated {category} concept based on a {label} graph topology. "
        f"Use {properties.get('vertices')} visible structural control points and {properties.get('edges')} elegant connecting ribs, "
        "with a clean architectural product-render style, accurate geometric relationships, professional lighting, "
        "and no text labels or watermarks. The design should look optimized, feasible, precise, and presentation-ready."
    )
    if style == "vivid":
        base_prompt += " Use dramatic material contrast and a high-end futuristic visual treatment."
    else:
        base_prompt += " Use realistic materials, balanced lighting, and restrained colors."
    if user_prompt:
        base_prompt += f" Additional direction: {user_prompt.strip()}"
    return base_prompt[:3900]


def generate_dalle3_image(prompt, quality="standard", style="natural", size="1024x1024"):
    import urllib.parse
    import random
    
    # We will use the pollinations AI image generation endpoint
    # which is completely free and keyless.
    seed = random.randint(1, 1000000)
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&seed={seed}"
    
    return {
        "ok": True,
        "provider": "pollinations",
        "model": "flux",
        "url": url,
        "revised_prompt": prompt,
    }
