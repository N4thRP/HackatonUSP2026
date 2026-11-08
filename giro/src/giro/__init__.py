"""Giro: previsão de no-show, contato e realocação de consultas."""
from pathlib import Path
import yaml

RAIZ = Path(__file__).resolve().parents[2]
DADOS = RAIZ / "dados"
SAIDAS = RAIZ / "saidas"


def carregar_config():
    with open(RAIZ / "config" / "fontes.yaml", encoding="utf-8") as f:
        fontes = yaml.safe_load(f)
    with open(RAIZ / "config" / "regras.yaml", encoding="utf-8") as f:
        regras = yaml.safe_load(f)
    return fontes, regras
