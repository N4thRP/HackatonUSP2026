"""Giro — interface do MVP (Streamlit, D20)."""
import json
import sys
import time
from html import escape
from pathlib import Path

import pandas as pd
import streamlit as st

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "src"))
from giro import DADOS, SAIDAS, carregar_config  # noqa: E402

OFERTAS_POR_DIA = carregar_config()[1]["tentativas_por_dia"]

st.set_page_config(page_title="Giro", page_icon=":material/autorenew:", layout="wide")

FAIXA = {"ALTO": ("Alto", "#C2412F", "#FFE6E1"), "MÉDIO": ("Médio", "#9A6200", "#FFF0D4"),
         "BAIXO": ("Baixo", "#0E7C70", "#D7F5EE")}
RESPOSTA = {"nao_vou": "Não vou", "remarcar": "Quero remarcar", "vou": "Vou"}

st.markdown("""
<style>
  .block-container{padding-top:3.4rem;max-width:1180px}
  [data-testid="stHeader"]{background:transparent}
  [data-testid="stTabs"] [role="tablist"]{gap:28px}
  [data-testid="stTab"] p{font-size:1.02rem;font-weight:600}
  h1{font-size:1.9rem!important;letter-spacing:-.01em;margin-bottom:.1rem!important}
  .sub{color:#3E5568;margin:0 0 1rem 0;font-size:.98rem}
  .cab{background:#fff;border:1px solid #DCE5EA;border-radius:14px;padding:16px 22px 14px;margin:0 0 10px 0}
  .cab-l1{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
  .cab-id{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px}
  .cab-tag{font-size:.9rem;color:#3E5568;padding-left:16px;border-left:3px solid #FF6B57}
  .cab-st{display:inline-flex;align-items:center;gap:7px;padding:3px 12px;border-radius:999px;background:#D7F5EE;
          color:#0E7C70;font-weight:600;font-size:.85rem;white-space:nowrap}
  .cab-st i{width:8px;height:8px;border-radius:50%;background:#14B8A6}
  .cab-un{font-size:1.02rem;font-weight:600;color:#0B4F6C;margin-top:2px}
  .cab-l2{display:flex;justify-content:space-between;gap:6px 16px;flex-wrap:wrap;margin-top:12px;padding-top:10px;
          border-top:1px solid #E4EBEF;font-size:.92rem;color:#3E5568}
  .cab-dia{font-weight:600;color:#0F1E2E}
  .faixa{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:.82rem;white-space:nowrap}
  .sim{border:1px dotted currentColor;background:transparent;color:inherit;border-radius:4px;padding:0 6px;font-size:.82rem;white-space:nowrap}
  .sim small{opacity:.75;margin-left:3px}
  table.ag{width:100%;border-collapse:collapse;font-size:.92rem}
  table.ag th{text-align:left;font-weight:600;color:#3E5568;border-bottom:2px solid #C9D6DE;padding:6px 8px;font-size:.85rem}
  table.ag td{border-bottom:1px solid #E1E9ED;padding:8px;vertical-align:top}
  .fat{color:#3E5568;font-size:.83rem}
  .st-ok{color:#0E7C70;font-weight:600}.st-lib{color:#C2412F;font-weight:600}.st-prox{color:#9A6200;font-weight:600}.st-cin{color:#5D7183}
  .of{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:5px 0;border-bottom:1px dashed #E1E9ED;font-size:.9rem}
  .of:last-child{border-bottom:0}
  .of .n{color:#5D7183;text-align:right;font-variant-numeric:tabular-nums}
  .ac{color:#0E7C70;font-weight:600}.ex{color:#8597A6}
  .subt{font-size:.85rem;font-weight:600;color:#3E5568;margin:10px 0 2px 0}
  .ganhou{background:#D7F5EE;border-radius:8px;padding:0 10px}
  .ganhou .of{border-bottom:0}
  .fim{border-left:4px solid #0B4F6C;background:#E8F7F4;padding:8px 12px;border-radius:0 8px 8px 0;margin-top:8px;font-size:.92rem}
  .fim.perdida{border-color:#C2412F;background:#FFE6E1}
  .bolha{background:#fff;border:1px solid #DCE5EA;border-radius:12px 12px 12px 3px;padding:9px 12px;margin:4px 0;max-width:620px;font-size:.92rem}
  .bolha.eu{margin-left:auto;background:#D7F5EE;border-radius:12px 12px 3px 12px;max-width:260px;text-align:right}
  .barras{display:grid;gap:8px;margin:8px 0}
  .br{display:grid;grid-template-columns:190px 1fr 120px;gap:12px;align-items:center;font-size:.92rem}
  .br .t{height:16px;background:#E1E9ED;border-radius:3px;overflow:hidden}
  .br .t div{height:100%;background:#0B4F6C}
  .legenda{font-size:.82rem;color:#3E5568;margin-top:6px}
  section[data-testid="stSidebar"][data-collapsed="false"]{width:272px!important;min-width:272px!important}
  [data-testid="stSidebar"] [data-testid="stSidebarContent"]{padding-top:0}
  [data-testid="stSidebarUserContent"]{padding:0 16px 16px 16px}
  [data-testid="stSidebar"] [data-testid="stVerticalBlock"] [data-testid="stVerticalBlock"]{background:rgba(255,255,255,.06);border-radius:12px;
          border-color:rgba(255,255,255,.16)!important}
  .sb-marca{margin:-2.2rem 0 16px 0}
  .sb-desc{font-size:.8rem;color:rgba(255,255,255,.75);margin-top:6px}
  .sb-sec{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7FE3D5;margin:-2px 0 2px 0}
  .sb-nota{font-size:.78rem;color:rgba(255,255,255,.75);line-height:1.5;margin-top:4px}
  .sb-nota b{color:#fff}
  .marca{display:inline-flex;align-items:flex-end;gap:0;vertical-align:middle}
  .marca svg{margin:0 .07em -.06em 0;flex:none}
  .marca-nome{font-family:"Sora",sans-serif;font-weight:800;font-size:.82em;letter-spacing:-.02em;line-height:1}
  h1,h2,h3,h4,.painel-t,.cab-un,.cx-resumo b{font-family:"Sora",sans-serif}
  .mapa{width:100%;height:auto;display:block;margin:-4px 0 6px 0}
  .painel{background:#fff;border:1px solid #DCE5EA;border-radius:14px;padding:18px 22px 16px;margin:4px 0 14px 0}
  .painel-t{font-size:1.15rem;font-weight:700;margin-bottom:12px}
  .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 24px}
  .kpi-t{display:flex;align-items:center;gap:8px;font-size:.88rem;color:#3E5568}
  .kpi-v{font-size:2.1rem;font-weight:700;line-height:1.15;margin:6px 0 2px;font-variant-numeric:tabular-nums}
  .kpi-s{font-size:.82rem;color:#5D7183}
  .painel-g{display:grid;grid-template-columns:1fr 1fr;gap:12px 32px;margin-top:16px;padding-top:14px;border-top:1px solid #E4EBEF}
  .painel-s{font-size:.85rem;font-weight:600;color:#3E5568;margin-bottom:6px}
  .pilha{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#E4EBEF;gap:2px}
  .pilha-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:.82rem;color:#3E5568;margin-top:6px}
  .pilha-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}
  .semantica{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 18px;margin:2px 0 12px 0}
  .semantica>div{display:flex;align-items:flex-start;gap:8px;font-size:.88rem}
  .semantica small{display:block;color:#5D7183;font-size:.78rem}
  .pac{display:flex;align-items:flex-start;gap:10px}
  .alav{display:grid;grid-template-columns:1fr 18px 1fr 18px 1fr 18px 1fr;align-items:stretch;gap:8px;margin:6px 0 4px 0}
  .alav-p{background:#fff;border:1px solid #DCE5EA;border-radius:12px;padding:12px 14px}
  .alav-p:last-child{border-color:#FF6B57;background:#FFF5F3}
  .alav-v{font-family:"Sora",sans-serif;font-size:1.45rem;font-weight:700;margin:6px 0 2px;font-variant-numeric:tabular-nums}
  .alav-seta{align-self:center;text-align:center;color:#8597A6;font-size:1.2rem}
  @media (max-width:900px){.alav{grid-template-columns:1fr}.alav-seta{transform:rotate(90deg)}}
  .chip-sem{margin-left:6px;padding:0 7px;border-radius:999px;font-size:.74rem;font-weight:600;color:#0B4F6C;
            background:#D7F5EE;white-space:nowrap}
  .chip60{margin-left:6px;padding:0 7px;border-radius:999px;font-size:.75rem;font-weight:700;color:#0B4F6C;background:#DCEAF1}
  details.rk{position:relative;flex:none;margin-top:3px}
  details.rk summary{list-style:none;cursor:pointer;display:block}
  details.rk summary::-webkit-details-marker{display:none}
  .rk-dot{display:block;width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 3px #fff,0 0 0 4px #C9D6DE;transition:box-shadow .15s}
  details.rk summary:hover .rk-dot,details.rk[open] .rk-dot{box-shadow:0 0 0 3px #fff,0 0 0 5px #0B4F6C}
  .rk-pop{position:absolute;left:-6px;top:24px;z-index:20;width:320px;background:#fff;border:1px solid #C9D6DE;border-radius:10px;
          box-shadow:0 8px 24px rgba(23,48,47,.16);padding:12px 14px;font-size:.86rem;color:#0F1E2E}
  .rk-cab{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-bottom:6px}
  .rk-sec{font-weight:700;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#3E5568;margin:8px 0 2px}
  .rk-pop ul{margin:0;padding-left:18px}
  .rk-pe{margin-top:8px;color:#5D7183;font-size:.8rem}
  @media (max-width:760px){.kpis,.semantica{grid-template-columns:repeat(2,minmax(0,1fr))}.painel-g{grid-template-columns:1fr}}
  .cx-svg{width:100%;height:auto;background:#fff;border:1px solid #DCE5EA;border-radius:10px;margin:6px 0 2px 0}
  .cx-svg .cx-dt{font-size:15px;font-weight:600;fill:#0F1E2E}
  .cx-svg .cx-sub{font-size:12.5px;fill:#5D7183}
  .cx-svg .cx-rot{font-size:13px;font-weight:600;fill:#0B4F6C}
  .cx-svg .cx-n{font-size:12px;font-weight:700;fill:#fff}
  .cx-arco{stroke-dasharray:1200;stroke-dashoffset:1200;animation:cxdesenha .9s ease-out forwards}
  @keyframes cxdesenha{to{stroke-dashoffset:0}}
  .cx-resumo{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:4px 0 10px 0;font-size:.95rem}
  .cx-tag{padding:2px 10px;border-radius:999px;font-weight:600;font-size:.85rem}
  .cx-tag.ok{background:#D7F5EE;color:#0E7C70}.cx-tag.perdida{background:#FFE6E1;color:#C2412F}
  .cx-etapa{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;margin:14px 0 2px 0;font-weight:600}
  .cx-num{width:26px;height:26px;border-radius:50%;background:#0B4F6C;color:#fff;display:flex;align-items:center;
          justify-content:center;font-size:.85rem}
  .cx-mov{margin:4px 0 4px 13px;padding:6px 0 6px 22px;border-left:3px solid #0B4F6C;font-size:.93rem;color:#0F1E2E}
</style>
""", unsafe_allow_html=True)


# ---------------- dados ----------------
ARQUIVOS_DADOS = [SAIDAS / "previsoes.csv", DADOS / "sinteticos.parquet", SAIDAS / "resumo_simulacao.json",
                  SAIDAS / "placar.csv", SAIDAS / "eventos.jsonl", SAIDAS / "eventos_particular.jsonl"]


def versao_dados():
    """Data de modificação dos arquivos lidos. Entra como argumento das funções com cache, para que elas
    releiam tudo quando a simulação for gerada de novo, sem precisar reiniciar o app."""
    return tuple(a.stat().st_mtime if a.exists() else 0.0 for a in ARQUIVOS_DADOS)


@st.cache_data
def carregar(versao):
    prev = pd.read_csv(SAIDAS / "previsoes.csv", parse_dates=["data_consulta", "data_agendamento"],
                       dtype={"id_paciente": str})
    sint = pd.read_parquet(DADOS / "sinteticos.parquet")
    prev = prev.merge(sint.drop(columns=["id_paciente"]), on="id_consulta", how="left")
    resumo = json.load(open(SAIDAS / "resumo_simulacao.json", encoding="utf-8"))
    placar = pd.read_csv(SAIDAS / "placar.csv") if (SAIDAS / "placar.csv").exists() else pd.DataFrame()
    return prev, resumo, placar


@st.cache_data
def eventos(regra, versao):
    """regra "geral" (D34, SUS) ou "particular" (D35, hospital particular)."""
    arquivo = "eventos.jsonl" if regra == "geral" else "eventos_particular.jsonl"
    return pd.read_json(SAIDAS / arquivo, lines=True)


def sim(txt):
    return f'<span class="sim">{escape(str(txt))}<small>simulado</small></span>'


def faixa_html(f):
    nome, cor, fundo = FAIXA[f]
    return f'<span class="faixa" style="color:{cor};background:{fundo}">{nome}</span>'


def paciente_curto(pid):
    s = str(pid)
    return f"Paciente …{s[-4:]}" if not s.startswith("B-") else f"Fila da regulação {s[-2:]}"


def brl(v):
    return f"R$ {v:,.0f}".replace(",", ".")


@st.cache_data
def dados_mapa():
    return json.load(open(Path(__file__).parent / "mapa.json", encoding="utf-8"))


def mapa_unidade(unidade):
    """Contorno de Vitória com um ponto por unidade e um pin vermelho na unidade escolhida."""
    M = dados_mapa()
    k = 0.938  # cos(20,3°): corrige a largura dos graus de longitude nessa latitude
    pts = [p for anel in M["vitoria"] for p in anel]
    xs, ys = [p[0] * k for p in pts], [-p[1] for p in pts]
    mx, my = min(xs), min(ys)
    W, PAD = 260, 10
    esc = (W - 2 * PAD) / (max(xs) - mx)
    H = (max(ys) - my) * esc + 2 * PAD + 8  # folga em cima para a cabeça do pin

    def f(lon, lat):
        return PAD + (lon * k - mx) * esc, PAD + 8 + (-lat - my) * esc

    def caminho(anel):
        return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in (f(*p) for p in anel)) + "Z"

    h = [f'<svg viewBox="0 0 {W} {H:.0f}" class="mapa" role="img" aria-label="Mapa de Vitória com a unidade escolhida">']
    h += [f'<path d="{caminho(anel)}" fill="#2C7896"/>' for anel in M["vitoria"]]
    for nome, (lat, lon) in M["bairros"].items():
        x, y = f(lon, lat)
        h.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.2" fill="#fff" fill-opacity=".85">'
                 f'<title>{escape(nome.title())}</title></circle>')
    if unidade in M["bairros"]:
        x, y = f(*M["bairros"][unidade][::-1])
        h.append(f'<g transform="translate({x:.1f},{y:.1f})"><title>{escape(unidade.title())}</title>'
                 '<path d="M0,0 C-2.5,-6 -9,-10 -9,-16 A9,9 0 1 1 9,-16 C9,-10 2.5,-6 0,0Z" fill="#FF6B57" '
                 'stroke="#fff" stroke-width="1.5"/><circle cx="0" cy="-16" r="3.4" fill="#fff"/></g>')
    h.append("</svg>")
    return "".join(h)


VERSAO = versao_dados()
prev, resumo, placar = carregar(VERSAO)

# ---------------- barra lateral ----------------
def simbolo(cor="#0B4F6C", tam=34):
    """Símbolo Giro (identidade v1.0): G que vira seta, traço 16u, raio 40u."""
    return (f'<svg width="{tam}" height="{tam}" viewBox="0 0 120 120" aria-hidden="true">'
            f'<path d="M84.6,28.5 A40,40 0 1 0 100,60" fill="none" stroke="{cor}" stroke-width="16"/>'
            f'<path d="M100,60 L72,60" stroke="{cor}" stroke-width="16" stroke-linecap="round"/>'
            f'<path d="M102,42 L70.4,40.2 L92.6,11.8Z" fill="{cor}" stroke="{cor}" stroke-width="3" stroke-linejoin="round"/></svg>')


def marca(cor="#0B4F6C", tam=34):
    """Logotipo "Giro": o símbolo faz o papel do G, seguido de "iro" em Sora (assinatura horizontal)."""
    return (f'<span class="marca" role="img" aria-label="Giro" style="font-size:{tam}px;color:{cor}">'
            f'{simbolo(cor, tam)}<span class="marca-nome">iro</span></span>')


with st.sidebar:
    st.markdown(f'<div class="sb-marca">{marca("#FFFFFF", 34)}'
                '<div class="sb-desc">Cada vaga encontra seu paciente.</div></div>', unsafe_allow_html=True)
    with st.container(border=True):
        st.markdown('<div class="sb-sec">Cenário</div>', unsafe_allow_html=True)
        valor = st.radio(":material/apartment: Tipo de serviço", ["Particular", "SUS"], index=0, horizontal=True,
                         help="Particular (convênio): R$ 128–195 por consulta; a vaga vai primeiro para quem tem consulta "
                              "uma semana depois, no mesmo horário (D35). SUS: R$ 13,85 por consulta perdida; a vaga vai "
                              "para quem espera há mais tempo (D34).")
    REGRA = "particular" if valor == "Particular" else "geral"
    ev = eventos(REGRA, VERSAO)
    # dia sugerido ao abrir: o com mais remarcações a partir das vagas liberadas dele (fixo pela regra geral,
    # para não mudar de dia quando o cenário muda)
    ev_g = eventos("geral", VERSAO)
    lib0 = ev_g[(ev_g.tipo == "vaga_liberada") & (ev_g.nivel == 0)]
    n_ac = ev_g[ev_g.tipo == "aceite"].groupby("raiz").size()
    lib0 = lib0.assign(remarc=lib0.id_consulta.map(n_ac).fillna(0))
    ranking = (lib0.merge(prev[["id_consulta", "data_consulta"]], on="id_consulta")
               .groupby(["unidade", "data_consulta"]).agg(remarc=("remarc", "sum"), vagas=("remarc", "size"))
               .sort_values(["remarc", "vagas"], ascending=False))
    padrao_u, padrao_d = ranking.index[0]
    unidades = sorted(prev["unidade"].unique())

    with st.container(border=True):
        st.markdown('<div class="sb-sec">Local e data</div>', unsafe_allow_html=True)
        unidade = st.selectbox(":material/location_on: Unidade", unidades, index=unidades.index(padrao_u),
                               format_func=str.title)
        st.markdown(mapa_unidade(unidade), unsafe_allow_html=True)
        dias = sorted(prev.loc[prev.unidade == unidade, "data_consulta"].dt.date.unique())
        dia = st.selectbox(":material/calendar_month: Dia da consulta", dias,
                           index=dias.index(padrao_d.date()) if padrao_d.date() in dias else 0,
                           format_func=lambda d: d.strftime("%d/%m/%Y"))
    st.markdown('<div class="sb-nota"><b>Sobre os dados.</b> Consultas reais de Vitória (ES), de 25/05 a 08/06/2016. '
                '<span class="sim">exemplo<small>simulado</small></span> marca dado sintético (horário, valor, '
                'distância e respostas).</div>', unsafe_allow_html=True)

SEMANA = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]
MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
         "novembro", "dezembro"]
ini, fim_per = prev.data_consulta.min(), prev.data_consulta.max()
st.markdown(
    f'<div class="cab"><div class="cab-l1"><div class="cab-id">{marca("#0B4F6C", 40)}'
    f'<span class="cab-tag">Realocação inteligente de consultas para clínicas privadas e para o SUS</span></div>'
    f'<span class="cab-st" title="Consultas reais de 2016; horários, respostas e fila são simulados">'
    f'<i></i>Simulação</span></div>'
    f'<div class="cab-un">Unidade {escape(unidade.title())} · Vitória (ES)</div>'
    f'<div class="cab-l2"><span class="cab-dia">{SEMANA[dia.weekday()]}, {dia.day} de {MESES[dia.month - 1]} de {dia.year}</span>'
    f'<span class="cab-per">Período simulado: {ini:%d/%m} a {fim_per:%d/%m/%Y}</span></div></div>',
    unsafe_allow_html=True)

dia_ts = pd.Timestamp(dia)
agenda = prev[(prev.unidade == unidade) & (prev.data_consulta == dia_ts)].sort_values("horario")
ids = set(agenda.id_consulta)
ev_u = ev[ev.unidade == unidade]
resp = ev_u[ev_u.tipo == "resposta"].set_index("id_consulta")["resposta"].to_dict()
contatados = set(ev_u.loc[ev_u.tipo == "contato", "id_consulta"])
avisados = set(ev_u.loc[(ev_u.tipo == "contato") & (ev_u.get("tipo_contato") == "AVISO"), "id_consulta"]) \
    if "tipo_contato" in ev_u else set()
aceites = ev_u[ev_u.tipo == "aceite"]
lib_u = ev_u[ev_u.tipo == "vaga_liberada"]

aba1, aba2, aba3, aba4 = st.tabs(["Agenda", "Contatos", "Realocação", "Painel"])

# ---------------- Agenda ----------------
PONTO_RISCO = {"ALTO": "#FF6B57", "MÉDIO": "#FFB547", "BAIXO": "#14B8A6"}
SEMANTICA = [  # (rótulo, cor do texto, fundo, significado, o que o Giro faz)
    ("Alto", "#C2412F", "#FFE6E1", "Requer atenção prioritária", "20% de maior risco do dia: pedido de confirmação 3 dias antes"),
    ("Médio", "#9A6200", "#FFF0D4", "Requer acompanhamento", "30% seguintes: lembrete com botão “não vou”"),
    ("Baixo", "#0E7C70", "#D7F5EE", "Sem alerta relevante", "Sem contato"),
    ("Aviso 60+", "#0B4F6C", "#DCEAF1", "Idoso na faixa Baixo", "Aviso 3 dias antes com botão “não vou”"),
]
ICONE = {  # ícones de traço, 18 px
    "agenda": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    "contato": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
    "vaga": '<path d="M4 21h16M6 21V4h9v17M15 6l4 2v13M12 12v1"/>',
    "falta": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    "dinheiro": '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
    "giro": '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v3.8h-3.8"/>',
    "relogio": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
}


def icone(nome, cor):
    return (f'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{cor}" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONE[nome]}</svg>')


def kpi(nome, cor, titulo, valor, sub, dica=""):
    return (f'<div class="kpi" title="{escape(dica)}"><div class="kpi-t">{icone(nome, cor)}{titulo}</div>'
            f'<div class="kpi-v">{valor}</div><div class="kpi-s">{sub}</div></div>')


def barra_empilhada(partes):
    """partes: [(rótulo, n, cor)] → barra horizontal com legenda."""
    tot = sum(n for _, n, _ in partes) or 1
    seg = "".join(f'<div style="width:{100 * n / tot:.2f}%;background:{c}" title="{r}: {n}"></div>'
                  for r, n, c in partes if n)
    leg = "".join(f'<span><i style="background:{c}"></i>{r} <b>{n}</b></span>' for r, n, c in partes)
    return f'<div class="pilha">{seg}</div><div class="pilha-leg">{leg}</div>'


def popover_risco(r, avisado):
    nome, cor, fundo = FAIXA[r.faixa]
    fatores = [x for x in [r.fator_1, r.fator_2, r.fator_3] if isinstance(x, str) and x]
    motivos = "".join(f"<li>{escape(f)}</li>" for f in fatores) or "<li>Nenhum fator de destaque</li>"
    acao = {"ALTO": "Recebe pedido de confirmação 3 dias antes.",
            "MÉDIO": "Recebe lembrete com botão “não vou” 3 dias antes."}.get(
        r.faixa, "Recebe aviso 3 dias antes por ter 60 anos ou mais." if avisado else "Não recebe contato.")
    return (f'<details class="rk"><summary title="Ver risco e motivo">'
            f'<span class="rk-dot" style="background:{PONTO_RISCO[r.faixa]}"></span></summary>'
            f'<div class="rk-pop"><div class="rk-cab"><span class="faixa" style="color:{cor};background:{fundo}">'
            f'Risco {nome.lower()}</span><span>{r.prob_falta:.0%} de chance estimada de faltar</span></div>'
            f'<div class="rk-sec">Por quê</div><ul>{motivos}</ul>'
            f'<div class="rk-sec">O que o Giro faz</div><div>{acao}</div>'
            f'<div class="rk-pe">Perfil: {escape(r.perfil_nome)}</div></div></details>')


with aba1:
    n_cons = len(agenda)
    n_cont = int(agenda.id_consulta.isin(contatados).sum())
    vagas_dia = [i for i in agenda.id_consulta if resp.get(i) in ("nao_vou", "remarcar")]
    st.markdown(
        '<div class="painel"><div class="painel-t">Visão geral do dia</div><div class="kpis">'
        + kpi("agenda", "#0B4F6C", "Consultas no dia", n_cons, "Total agendado")
        + kpi("contato", "#0B4F6C", "Contatadas", n_cont, f"{n_cont / max(n_cons, 1):.0%} das consultas")
        + kpi("vaga", "#14B8A6", "Vagas liberadas", len(vagas_dia), "Disponíveis para realocação")
        + kpi("falta", "#E0951F", "Faltas reais", int(agenda.falta.sum()), "Do dataset, só para avaliar o modelo",
              "Vem do dataset real. Serve só para avaliar; a unidade não vê esse número antes da consulta.")
        + '</div><div class="painel-g"><div><div class="painel-s">Risco das consultas</div>'
        + barra_empilhada([(FAIXA[f][0], int((agenda.faixa == f).sum()), PONTO_RISCO[f]) for f in FAIXA])
        + '</div><div><div class="painel-s">Respostas aos contatos</div>'
        + barra_empilhada([("Confirmaram", sum(resp.get(i) == "vou" for i in agenda.id_consulta), "#14B8A6"),
                           ("Liberaram a vaga", len(vagas_dia), "#FF6B57"),
                           ("Sem resposta", n_cont - sum(i in resp for i in agenda.id_consulta), "#C5D1D8")])
        + '</div></div></div>', unsafe_allow_html=True)

    st.markdown('<div class="semantica">' + "".join(
        f'<div><span class="faixa" style="color:{c};background:{f}">{r}</span><span><b>{s}</b>'
        f'<small>{a}</small></span></div>' for r, c, f, s, a in SEMANTICA) + "</div>", unsafe_allow_html=True)

    ver = st.radio("Mostrar", ["Só quem recebeu contato", "Todas as consultas"], horizontal=True, key="ver_agenda")
    tabela = agenda if ver == "Todas as consultas" else agenda[(agenda.faixa != "BAIXO") | agenda.id_consulta.isin(contatados)]
    linhas = []
    for r in tabela.itertuples():
        if r.id_consulta in contatados:
            rr = resp.get(r.id_consulta)
            if rr in ("nao_vou", "remarcar"):
                status = f'<span class="st-lib">{RESPOSTA[rr]}: vaga liberada</span>'
            elif rr == "vou":
                status = '<span class="st-ok">Confirmou</span>'
            else:
                status = '<span class="st-cin">Sem resposta (reenviado)</span>'
        else:
            status = '<span class="st-cin">Sem contato</span>'
        avisado = r.id_consulta in avisados
        chip = '<span class="chip60">60+</span>' if avisado else ""
        linhas.append(
            f"<tr><td>{sim(r.horario)}</td><td><div class='pac'>{popover_risco(r, avisado)}<div>"
            f"{paciente_curto(r.id_paciente)}{chip}<br><span class='fat'>{int(r.idade)} anos · "
            f"{escape(r.perfil_nome)}</span></div></div></td><td>{status}</td></tr>")
    st.markdown("<table class='ag'><tr><th>Horário</th><th>Paciente</th><th>Situação</th></tr>"
                + "".join(linhas) + "</table>", unsafe_allow_html=True)
    st.caption("Clique na bolinha ao lado do paciente para ver o risco e o motivo.")

# ---------------- Contatos ----------------
with aba2:
    cont = ev_u[(ev_u.tipo == "contato") & ev_u.id_consulta.isin(ids)]
    if cont.empty:
        st.info("Nenhum paciente deste dia ficou nas faixas Alto ou Médio. Escolha outro dia na barra lateral.")
    filtro = st.radio("Mostrar", ["Todos", "Liberaram a vaga", "Confirmaram", "Sem resposta"], horizontal=True, key="ver_contatos")
    for c in cont.itertuples():
        rr = resp.get(c.id_consulta)
        if filtro == "Liberaram a vaga" and rr not in ("nao_vou", "remarcar"):
            continue
        if filtro == "Confirmaram" and rr != "vou":
            continue
        if filtro == "Sem resposta" and rr is not None:
            continue
        linha = agenda[agenda.id_consulta == c.id_consulta].iloc[0]
        extra = " · aviso 60+" if getattr(c, "tipo_contato", "") == "AVISO" else ""
        st.markdown(f"**{paciente_curto(linha.id_paciente)}** · {faixa_html(c.faixa)}{extra} · {escape(linha.perfil_nome)} · "
                    f"enviado em {pd.Timestamp(c.dia).strftime('%d/%m')}", unsafe_allow_html=True)
        st.markdown(f'<div class="bolha">{escape(c.mensagem)}</div>', unsafe_allow_html=True)
        if rr:
            st.markdown(f'<div class="bolha eu">{RESPOSTA[rr]} <span class="sim">resposta<small>simulado</small></span></div>',
                        unsafe_allow_html=True)
        else:
            st.markdown('<div class="bolha eu" style="opacity:.6">sem resposta</div>', unsafe_allow_html=True)

# ---------------- Realocação ----------------
FIM_TXT = {
    "fila_sem_horario": ("ok", "Paciente da fila da regulação atendido",
                         "A cadeia terminou com alguém que não tinha horário marcado: uma consulta a mais na unidade."),
    "volta_agenda": ("ok", "Horário volta para a agenda",
                     "O último horário livre está a 5+ dias úteis, com tempo de sobra para a unidade marcar alguém."),
    "perdida": ("perdida", "Último horário perdido",
                "O último horário ficou perto demais para alguém marcar e foi perdido."),
    "nao_preenchida": ("perdida", "Vaga não preenchida",
                       "Ninguém da fila aceitou a vaga antes do prazo."),
}
FIM_PONTO = {"fila_sem_horario": ("#14B8A6", "preenchida pela fila"), "volta_agenda": ("#14B8A6", "volta à agenda"),
             "perdida": ("#C2412F", "perdido")}
FIM_CURTO = {"fila_sem_horario": "paciente da fila atendido", "volta_agenda": "volta para a agenda",
             "perdida": "último horário perdido", "nao_preenchida": "não preenchida"}


@st.cache_data
def cascatas_unidade(unidade, regra, versao):
    """Uma linha por cascata (vaga liberada por 'não vou'/'quero remarcar') da unidade."""
    ev = eventos(regra, versao)
    e = ev[ev.unidade == unidade]
    raizes = e[(e.tipo == "vaga_liberada") & (e.nivel == 0)].id_consulta.astype(int)
    ac = e[e.tipo == "aceite"]
    fim = e[e.tipo == "fim_cadeia"].sort_values("t").groupby("raiz").resultado.last()
    base = prev.set_index("id_consulta").loc[raizes, ["data_consulta", "horario"]].reset_index()
    base["remarcacoes"] = base.id_consulta.map(ac.groupby("raiz").size()).fillna(0).astype(int)
    base["fim"] = base.id_consulta.map(fim)
    return base


def montar_cadeia(rid):
    """Etapas da cascata: cada etapa é um horário livre, as ofertas feitas para ele e quem aceitou."""
    c = ev_u[ev_u.raiz == rid].sort_values(["t", "nivel"])
    vagas = c[c.tipo == "vaga_liberada"].sort_values("nivel")
    etapas = []
    for v in vagas.itertuples():
        info = prev_id.loc[int(v.id_consulta)]
        bloco = c[c.nivel == v.nivel]
        ac = bloco[bloco.tipo == "aceite"]
        etapas.append({"nivel": int(v.nivel), "data": pd.Timestamp(info.data_consulta), "horario": info.horario,
                       "liberada_em": pd.Timestamp(v.dia), "dono": info.id_paciente,
                       "ofertas": bloco[bloco.tipo == "oferta"], "aceite": ac.iloc[0] if len(ac) else None})
    fins = c[c.tipo == "fim_cadeia"]
    return etapas, (fins.iloc[-1].resultado if len(fins) else "nao_preenchida")


def plural(n, um, varios):
    return f"{n} {um if n == 1 else varios}"


def svg_mapa(etapas, fim, passo):
    """Linha do tempo: cada horário livre é um ponto; cada seta é um paciente que antecipou a consulta."""
    datas = [e["data"] for e in etapas]
    d0, d1 = min(datas), max(datas)
    vao = max((d1 - d0).days, 1)
    W, X0, X1, Y = 1000, 70, 930, 150
    x = lambda d: X0 + (X1 - X0) * (d - d0).days / vao if len(set(datas)) > 1 else (X0 + X1) / 2
    partes = [f'<svg viewBox="0 0 {W} 215" class="cx-svg" role="img" aria-label="Mapa da cascata">',
              '<defs><marker id="pt" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
              'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0B4F6C"/></marker></defs>',
              f'<line x1="{X0 - 30}" y1="{Y}" x2="{X1 + 30}" y2="{Y}" stroke="#C9D6DE" stroke-width="2"/>']
    # semanas no eixo
    for d in pd.date_range(d0.normalize(), d1.normalize(), freq="W-MON"):
        partes.append(f'<line x1="{x(d):.0f}" y1="{Y - 5}" x2="{x(d):.0f}" y2="{Y + 5}" stroke="#C9D6DE"/>')
    vis = etapas[:passo]
    for k, e in enumerate(vis):
        a = e["aceite"]
        if a is None or k + 1 >= len(etapas) or k + 1 >= passo:
            continue
        xa, xb = x(etapas[k + 1]["data"]), x(e["data"])
        h = 70 + 45 * (k % 2)  # alterna a altura para os rótulos de arcos vizinhos não se sobreporem
        meio = (xa + xb) / 2
        partes.append(f'<path d="M{xa:.0f},{Y - 10} Q{meio:.0f},{Y - h} {xb + 6:.0f},{Y - 12}" fill="none" '
                      f'stroke="#0B4F6C" stroke-width="2.5" marker-end="url(#pt)" class="cx-arco"/>')
        dias = (etapas[k + 1]["data"] - e["data"]).days
        ytop = Y - h / 2 - 18  # logo acima do topo da curva
        partes.append(f'<circle cx="{meio - 34:.0f}" cy="{ytop - 5:.0f}" r="10" fill="#0B4F6C"/>'
                      f'<text x="{meio - 34:.0f}" y="{ytop:.0f}" text-anchor="middle" class="cx-n">{k + 1}</text>'
                      f'<text x="{meio - 19:.0f}" y="{ytop:.0f}" class="cx-rot">−{plural(dias, "dia", "dias")}</text>')
    for k, e in enumerate(vis):
        final = k == len(etapas) - 1 and passo == len(etapas)
        if k == 0:
            cor, rot = "#C2412F", "liberada"
        elif final and fim in FIM_PONTO:
            cor, rot = FIM_PONTO[fim]
        else:
            cor, rot = "#0B4F6C", "ficou livre"
        xx = x(e["data"])
        partes.append(f'<circle cx="{xx:.0f}" cy="{Y}" r="9" fill="{cor}" stroke="#fff" stroke-width="3"/>')
        partes.append(f'<text x="{xx:.0f}" y="{Y + 30}" text-anchor="middle" class="cx-dt">{e["data"]:%d/%m}</text>')
        partes.append(f'<text x="{xx:.0f}" y="{Y + 48}" text-anchor="middle" class="cx-sub">{escape(rot)}</text>')
    if passo == len(etapas) and fim == "fila_sem_horario":
        xx = x(etapas[-1]["data"])
        partes.append(f'<path d="M{xx:.0f},22 L{xx:.0f},{Y - 14}" stroke="#14B8A6" stroke-width="2.5" '
                      f'stroke-dasharray="5 4" marker-end="url(#pt)"/>'
                      f'<text x="{xx:.0f}" y="16" text-anchor="middle" class="cx-rot" fill="#14B8A6">'
                      f'fila da regulação</text>')
    partes.append("</svg>")
    return "".join(partes)


def html_ofertas(ofertas):
    def linha(o, res):
        tipo = "já tem consulta mais tarde" if o.tipo_fila == "A" else "fila sem horário"
        chip = '<span class="chip-sem">mesmo horário, 1 semana depois</span>' if getattr(o, "criterio", "") == "semana" else ""
        return (f'<div class="of"><span class="n">{int(o.ordem)}º</span>'
                f'<span>{paciente_curto(o.quem)}{chip} · {tipo} · espera {o.espera_dias:.0f} dias · '
                f'{sim(f"{o.distancia_km:.1f} km")}</span>{res}</div>')
    if not len(ofertas):
        return ('<p class="ex" style="margin:4px 0">Nenhuma oferta enviada: não havia ninguém elegível na fila nesse '
                'momento (mesma unidade, consulta a 5+ dias úteis de hoje ou fila sem horário) ou não sobrou tempo '
                'antes do prazo.</p>')
    sem = ofertas[ofertas.resultado != "aceite"]
    ac = ofertas[ofertas.resultado == "aceite"]
    h = []
    if len(sem):
        h.append(f'<div class="subt">Sem resposta em 30 min ({len(sem)})</div>')
        for o in (sem if len(sem) <= 8 else sem.head(6)).itertuples():
            h.append(linha(o, '<span class="ex">não respondeu</span>'))
        if len(sem) > 8:
            h.append(f'<div class="of"><span class="n">…</span>'
                     f'<span class="ex">mais {len(sem) - 6} ofertas sem resposta</span><span></span></div>')
    if len(ac):
        h.append('<div class="subt">Ficou com a vaga</div><div class="ganhou">'
                 + linha(ac.iloc[0], '<span class="ac">aceitou</span>') + "</div>")
    else:
        ult = ofertas.iloc[-1]  # ofertas vão até 2 h antes do dia da vaga (vaga_dia * OFERTAS_POR_DIA, D19)
        if ult.t + 1 < ult.vaga_dia * OFERTAS_POR_DIA:
            h.append('<div class="subt">Ninguém aceitou e a fila acabou: não havia mais ninguém elegível</div>')
        else:
            h.append('<div class="subt">Ninguém aceitou antes do prazo (até 2 h antes da consulta)</div>')
    return "".join(h)


def desenhar_cascata(etapas, fim, passo, raiz_resp):
    st.markdown(svg_mapa(etapas, fim, passo), unsafe_allow_html=True)
    st.caption("Cada ponto é um horário livre; cada seta é um paciente que trocou o horário dele por um mais cedo (o número é a etapa na lista abaixo). "
               "O horário que ele deixou fica livre e é oferecido de novo à fila.")
    for k, e in enumerate(etapas[:passo]):
        a = e["aceite"]
        if k == 0:
            titulo = (f'{e["data"]:%d/%m} às {sim(e["horario"])} · liberada em {e["liberada_em"]:%d/%m} porque '
                      f'{paciente_curto(e["dono"])} respondeu “{RESPOSTA[raiz_resp]}”')
        else:
            titulo = (f'{e["data"]:%d/%m} às {sim(e["horario"])} · horário que '
                      f'{paciente_curto(e["dono"])} deixou ao antecipar')
        n_of = len(e["ofertas"])
        st.markdown(f'<div class="cx-etapa"><span class="cx-num">{k + 1}</span><div>{titulo}</div></div>',
                    unsafe_allow_html=True)
        if a is not None:
            if a.tipo_fila == "A":
                dias = (pd.Timestamp(a.dia_antigo) - e["data"]).days
                mov = (f'<b>{paciente_curto(a.quem)}</b> aceitou na {int(e["ofertas"].ordem.max())}ª '
                       f'oferta e antecipou a consulta de <b>{pd.Timestamp(a.dia_antigo):%d/%m}</b> para '
                       f'<b>{e["data"]:%d/%m}</b>: <b>{plural(dias, "dia", "dias")}</b> antes. '
                       f'Esperava havia {plural(int(a.espera_dias), "dia", "dias")}.')
                ganhou = e["ofertas"][e["ofertas"].resultado == "aceite"]
                if len(ganhou) and ganhou.iloc[0].get("criterio") == "semana":
                    mov += ' <span class="chip-sem">mesmo horário, 1 semana depois</span>'
            else:
                mov = (f'<b>{paciente_curto(a.quem)}</b>, que não tinha horário marcado, aceitou na '
                       f'{int(e["ofertas"].ordem.max())}ª oferta depois de {plural(int(a.espera_dias), "dia", "dias")} de espera.')
            st.markdown(f'<div class="cx-mov">↓ {mov}</div>', unsafe_allow_html=True)
        with st.expander(("Ver a oferta desta etapa" if n_of == 1 else f"Ver as {n_of} ofertas desta etapa")
                         if n_of else "Por que não houve ofertas"):
            st.markdown(html_ofertas(e["ofertas"]), unsafe_allow_html=True)
    if passo == len(etapas):
        cls, tit, txt = FIM_TXT[fim]
        st.markdown(f'<div class="fim {"" if cls == "ok" else "perdida"}"><b>{tit}.</b> {txt}</div>',
                    unsafe_allow_html=True)


with aba3:
    prev_id = prev.set_index("id_consulta")
    todas = cascatas_unidade(unidade, REGRA, VERSAO)
    do_dia = todas[todas.data_consulta == dia_ts]
    if todas.empty:
        st.info("Nenhuma vaga foi liberada nesta unidade no período. Escolha outra unidade na barra lateral.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Vagas liberadas na unidade", len(todas))
        c2.metric("Com remarcação", int((todas.remarcacoes > 0).sum()),
                  f"{(todas.remarcacoes > 0).mean():.0%} das liberadas".replace(".", ","), delta_color="off")
        c3.metric("Pacientes remarcados", int(todas.remarcacoes.sum()), help="Pacientes que mudaram de horário.")
        c4.metric("Maior cascata", int(todas.remarcacoes.max()), help="Número de remarcações na maior cascata.")

        tem_dia = (do_dia.remarcacoes > 0).any()
        origem = st.radio("Cascatas", ["Deste dia", "De todo o período"], horizontal=True,
                          index=0 if tem_dia else 1, key="cx_origem",
                          help="'Deste dia' usa o dia escolhido na barra lateral.")
        so_andaram = st.toggle("Só cascatas com remarcação", value=True, key="cx_andaram")
        lista = do_dia if origem == "Deste dia" else todas
        if so_andaram:
            lista = lista[lista.remarcacoes > 0]
        if not tem_dia:
            st.caption(f"Nenhuma vaga liberada de {dia:%d/%m} foi remarcada nesta unidade; mostrando o período inteiro.")
        if lista.empty:
            st.info("Nenhuma cascata com esse filtro. Desligue “Só cascatas com remarcação” ou escolha “De todo o período”.")
        else:
            lista = lista.sort_values(["remarcacoes", "data_consulta"], ascending=[False, True])

            def rotulo(rid):
                l = lista.set_index("id_consulta").loc[rid]
                n = int(l.remarcacoes)
                qtd = "nenhuma remarcação" if n == 0 else f"{n} remarcaç{'ão' if n == 1 else 'ões'}"
                return f"{l.data_consulta:%d/%m} {l.horario} · {qtd} · {FIM_CURTO.get(l.fim, '')}"

            rid = st.selectbox("Escolha uma cascata", list(lista.id_consulta), format_func=rotulo, key="cx_raiz",
                               help="Ordenadas da maior para a menor cascata.")
            etapas, fim = montar_cadeia(rid)
            n = len(etapas)
            movs = [e["aceite"] for e in etapas if e["aceite"] is not None]
            dias_ant = sum((pd.Timestamp(a.dia_antigo) - e["data"]).days
                           for e in etapas if (a := e["aceite"]) is not None and a.tipo_fila == "A")
            cls, tit, _ = FIM_TXT[fim]
            st.markdown(
                f'<div class="cx-resumo"><span><b>{len(movs)}</b> {"paciente mudou" if len(movs) == 1 else "pacientes mudaram"} '
                f'de horário</span><span><b>{dias_ant}</b> {"dia" if dias_ant == 1 else "dias"} de consulta '
                f'antecipados</span>'
                f'<span class="cx-tag {cls}">{tit}</span></div>', unsafe_allow_html=True)

            b1, b2 = st.columns([1, 4])
            tocar = b1.button("▶ Reproduzir", key="cx_play", disabled=n == 1, use_container_width=True)
            passo = n if n == 1 else b2.select_slider(
                "Avançar a cascata", options=list(range(1, n + 1)), value=n, key=f"cx_passo_{rid}",
                format_func=lambda k: f"etapa {k} de {n}", label_visibility="collapsed")
            area = st.empty()
            if tocar:
                for p in range(1, n + 1):
                    with area.container():
                        desenhar_cascata(etapas, fim, p, resp.get(rid, "nao_vou"))
                    time.sleep(1.2)
            else:
                with area.container():
                    desenhar_cascata(etapas, fim, passo, resp.get(rid, "nao_vou"))
        if REGRA == "particular":
            st.caption("Ordem da fila (particular, D35): primeiro quem tem consulta uma semana depois, no mesmo horário; "
                       "sem essa pessoa ou sem aceite, quem espera há mais tempo. "
                       "Quem já tem consulta só recebe oferta se ela estiver a 5+ dias úteis.")
        else:
            st.caption("Ordem da fila (SUS, D34): quem espera há mais tempo recebe a oferta primeiro. "
                       "Quem já tem consulta só recebe oferta se ela estiver a 5+ dias úteis.")

# ---------------- Painel ----------------
with aba4:
    chave_r = "particular" if REGRA == "particular" else "produto"
    if chave_r not in resumo:
        st.error(f"O resumo da simulação não tem os números do cenário {'Particular' if REGRA == 'particular' else 'SUS'}. Rode `python simular.py` "
                 "para gerar as duas regras e recarregue a página.")
        st.stop()
    r = resumo[chave_r]
    ctl = resumo.get("particular_aleatorio" if REGRA == "particular" else "aleatorio")
    st.markdown(f"#### Período inteiro · {r['unidades']} unidades · {r['dias_uteis']} dias úteis · {r['consultas']:,} consultas".replace(",", "."))
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Faltas no período", f"{r['faltas']:,}".replace(",", "."))
    c2.metric("Vagas liberadas", f"{r['vagas_liberadas']:,}".replace(",", "."))
    c3.metric("Vagas recuperadas", f"{r['vagas_recuperadas']:,}".replace(",", "."),
              help="Só conta quando a cadeia termina num paciente da fila sem horário ou num horário que volta à agenda (D25).")
    if valor == "Particular":
        c4.metric("Receita recuperada", brl(r["valor_recuperado_convenio"]), f"{r['M9']:.1%} da perda".replace(".", ","))
    else:
        c4.metric("Pacientes da fila atendidos", r["pacientes_b_atendidos"],
                  f"+ {r['dias_antecipados_tipo_a']:,.0f} dias antecipados".replace(",", "."))

    st.markdown("#### Comparação")
    chave = "valor_recuperado_convenio" if valor == "Particular" else "vagas_recuperadas"
    linhas = [("Sem o produto", 0), ("Contato sorteado, sem modelo", ctl[chave] if ctl else 0), ("Giro", r[chave])]
    maior = max(v for _, v in linhas) or 1
    fmt = brl if valor == "Particular" else (lambda v: f"{v:,.0f} vagas".replace(",", "."))
    st.markdown('<div class="barras">' + "".join(
        f'<div class="br"><span>{n}</span><div class="t"><div style="width:{100*v/maior:.0f}%"></div></div><span>{fmt(v)}</span></div>'
        for n, v in linhas) + "</div>", unsafe_allow_html=True)
    if valor == "Particular":
        st.caption(f"Cerca de {brl(r['por_unidade_mes_convenio'])} por unidade por mês. "
                   f"O sorteio usa as mesmas quantidades de contato, sem o modelo.")
    else:
        st.caption(f"No SUS o valor por consulta é baixo ({brl(r['valor_recuperado_sus'])} no período); "
                   "o ganho é a fila andar: pacientes atendidos antes.")

    # ---- Cobrança: coparticipação no privado (D36), assinatura no SUS (D37) ----
    meses = r["dias_uteis"] / 22
    n_liberadas = f"{r['vagas_liberadas']:,}".replace(",", ".")
    n_mais = f"{r['vagas_recuperadas']:,}".replace(",", ".")
    if valor == "Particular":
        st.markdown("#### Coparticipação: o Giro ganha quando a clínica ganha")
        pct = st.slider("Percentual da coparticipação", 5, 40, 20, step=5, format="%d%%", key="copart",
                        help="Percentual da receita das consultas recuperadas que fica com o Giro (D36). "
                             "O valor final ainda será definido; este controle serve para simular.") / 100
        receita = r["valor_recuperado_convenio"]
        por_mes = receita / r["unidades"] / meses
        passos = [
            ("vaga", "#0B4F6C", "Vagas liberadas antes da falta", n_liberadas, "pacientes avisaram que não iam"),
            ("agenda", "#14B8A6", "Consultas a mais", n_mais, "vagas que viraram atendimento"),
            ("dinheiro", "#0B4F6C", "Receita recuperada pela clínica", brl(receita), f"{brl(por_mes)} por unidade/mês"),
            ("giro", "#FF6B57", f"Parte do Giro ({pct:.0%})", brl(receita * pct), f"{brl(por_mes * pct)} por unidade/mês"),
        ]
        legenda = (f"A clínica fica com {brl(receita * (1 - pct))} ({1 - pct:.0%}) da receita recuperada e só paga quando há "
                   "consulta recuperada. Menos faltas e vagas ociosas → mais pacientes atendidos → mais receita para a "
                   "clínica → mais receita para o Giro. Base: as vagas reocupadas registradas pelo Giro, que o cliente pode "
                   "auditar. Período simulado de 9 dias úteis.")
    else:
        st.markdown("#### Assinatura: valor fixo por unidade no SUS")
        assin = st.slider("Assinatura mensal por unidade (R$)", 100, 2000, 500, step=100, key="assin",
                          help="Valor fixo que cada unidade pública paga por mês (D37). O valor final ainda será definido; "
                               "este controle serve para simular.")
        total = assin * r["unidades"] * meses
        custo = total / max(r["vagas_recuperadas"], 1)
        dias = f"{r['dias_antecipados_tipo_a']:,.0f}".replace(",", ".")
        passos = [
            ("vaga", "#0B4F6C", "Vagas liberadas antes da falta", n_liberadas, "pacientes avisaram que não iam"),
            ("agenda", "#14B8A6", "Consultas a mais", n_mais, "pacientes atendidos que ficariam sem vaga"),
            ("relogio", "#0B4F6C", "Dias de consulta antecipados", dias, "pacientes atendidos antes"),
            ("giro", "#FF6B57", "Assinatura do Giro", f"{brl(assin)}/mês",
             f"por unidade · ≈ {brl(custo)} por consulta a mais".replace("R$ ", "R$\u00a0")),
        ]
        legenda = (f"No SUS não há lucro a dividir: a cobrança é uma assinatura fixa por unidade (D37), previsível para o "
                   f"orçamento público. Com {brl(assin)} por mês, as {r['unidades']} unidades pagariam {brl(total)} no período "
                   f"simulado de 9 dias úteis, cerca de {brl(custo)} por consulta a mais; uma falta custa R$ 13,85 ao SUS.")
    st.markdown('<div class="alav">' + '<span class="alav-seta">→</span>'.join(
        f'<div class="alav-p"><div class="kpi-t">{icone(ic, cor)}{tit}</div><div class="alav-v">{v}</div>'
        f'<div class="kpi-s">{sub}</div></div>' for ic, cor, tit, v, sub in passos) + "</div>", unsafe_allow_html=True)
    st.caption(legenda)

    st.markdown("#### Quem ganhou as vagas")
    c1, c2, c3 = st.columns(3)
    c1.metric("Espera média dos beneficiados", f"{r['espera_media_beneficiados']:.0f} dias")
    c2.metric("Vieram da fila da regulação", f"{r['pacientes_b_atendidos'] / max(r['movimentos'], 1):.0%}",
              help="Parte dos beneficiados que não tinha nenhum horário marcado.")
    c3.metric("Primeira vaga preenchida", f"{r['M8']:.1%}".replace(".", ","),
              help="Desta rodada (semente 42). O placar usa a média de 5 sementes. M8, meta 45%.")
    if REGRA == "particular":
        n_sem = r.get("aceites_mesmo_horario", 0)
        pct = f"{n_sem / max(r['movimentos'], 1):.1%}".replace(".", ",")
        tot = f"{r['movimentos']:,}".replace(",", ".")
        st.caption(f"Particular (D35): {n_sem} das {tot} remarcações ({pct}) foram para quem tinha consulta uma semana "
                   "depois, no mesmo horário; as outras caíram na regra geral (quem espera há mais tempo).")

    if "cobertura_faltosos" in r:
        st.markdown("#### Quem recebe contato, entre os que faltariam")
        cob = r["cobertura_faltosos"]["faixa_etaria"]
        st.markdown('<div class="barras">' + "".join(
            f'<div class="br"><span>{k} anos</span><div class="t"><div style="width:{100*v:.0f}%"></div></div><span>{v:.0%}</span></div>'
            for k, v in cob.items()) + "</div>", unsafe_allow_html=True)
        st.caption(f"Maior diferença entre grupos: {r['M5_cobertura_gap_pp']:.1f} pontos. "
                   "Idosos de 60+ fora das faixas Alto e Médio recebem aviso 3 dias antes.")

    if not placar.empty:
        st.markdown("#### Placar das metas")
        ult = placar.iloc[-1]
        metas = [
            ("M1", "AUC-ROC", ">=", 0.75, "{:.3f}"), ("M2", "Recall nos 20% de maior risco", ">=", 0.40, "{:.1%}"),
            ("M3", "Precisão nos 20% de maior risco", ">=", 0.36, "{:.1%}"), ("M4", "Erro de calibração", "<=", 0.03, "{:.3f}"),
            ("M5", "Diferença na cobertura de contato entre grupos (p.p.)", "<=", 10, "{:.1f}"),
            ("M6", "Vagas liberadas sem resposta ativa", "<=", 0, "{:.0f}"),
            ("M7", "Regras da lista de espera", "=", "100%", "{}"),
            ("M8", "Primeira vaga preenchida", ">=", 0.45, "{:.1%}"), ("M9", "Perda recuperada", ">=", 0.10, "{:.1%}"),
            ("M10", "Tempo por realocação (s)", "<=", 2, "{:.4f}"),
            ("M11", "Sintéticos batem com as fontes", "=", "100%", "{}"), ("M12", "Nada sintético no treino", "=", "100%", "{}"),
        ]
        TOLERANCIA = 0.05  # "próxima": não atinge a meta, mas fica a até 5% dela
        SITUACAO = {"ok": ("st-ok", "atingida"), "prox": ("st-prox", "próxima"), "abaixo": ("st-lib", "abaixo")}
        linhas = []
        for k, nome, op, meta, fmt in metas:
            v = ult[k]
            try:
                v = float(v)
                ok = v >= meta if op == ">=" else v <= meta
                perto = meta != 0 and abs(v - meta) / abs(meta) <= TOLERANCIA
                sit = "ok" if ok else ("prox" if perto else "abaixo")
                txt = fmt.format(v)
            except (TypeError, ValueError):
                sit, txt = ("ok" if v == meta else "abaixo"), str(v)
            meta_txt = fmt.format(meta) if not isinstance(meta, str) else meta
            cls, rot = SITUACAO[sit]
            linhas.append(f"<tr><td>{k}</td><td>{nome}</td><td>{ {'>=': '≥', '<=': '≤'}.get(op, op)} {meta_txt}</td><td>{txt}</td>"
                          f"<td class='{cls}'>{rot}</td></tr>")
        st.markdown("<table class='ag'><tr><th></th><th>Métrica</th><th>Meta</th><th>Resultado</th><th></th></tr>"
                    + "".join(linhas) + "</table>", unsafe_allow_html=True)
        st.caption("Atingida: cumpre a meta. Próxima: não cumpre, mas fica a até 5% do valor da meta. "
                   "Abaixo: fica mais longe que isso.")
        if "M5a" in ult and pd.notna(ult["M5a"]):
            st.caption(f"Informativo · M5a, ordenação do modelo entre grupos: {float(ult['M5a']):.1f} p.p. "
                       "(medida antiga da M5, mantida por transparência).")
        st.caption(f"Versão {ult['versao']}, medida em {ult['data']}. M8 e M9 são a média de 5 sementes. "
                   f"{ult['nota']}. Histórico completo em saidas/placar.csv.")
