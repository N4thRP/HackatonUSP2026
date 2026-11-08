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

st.set_page_config(page_title="Giro", page_icon="🩺", layout="wide")

COR_SISREG = {"vermelho": "#C0392B", "amarelo": "#D4A017", "verde": "#3F8F3A", "azul": "#2F6FB0"}
FAIXA = {"ALTO": ("Alto", "#B43C2A", "#F7E3DE"), "MÉDIO": ("Médio", "#8A6512", "#F5ECD2"),
         "BAIXO": ("Baixo", "#3E6B52", "#E1EEE6")}
RESPOSTA = {"nao_vou": "Não vou", "remarcar": "Quero remarcar", "vou": "Vou"}

st.markdown("""
<style>
  .block-container{padding-top:1.6rem;max-width:1180px}
  h1{font-size:1.9rem!important;letter-spacing:-.01em;margin-bottom:.1rem!important}
  .sub{color:#4E6462;margin:0 0 1rem 0;font-size:.98rem}
  .faixa{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:600;font-size:.82rem;white-space:nowrap}
  .sim{border:1px dashed #A8753F;background:#FBF3E8;color:#7A4A22;border-radius:4px;padding:0 6px;font-size:.82rem;white-space:nowrap}
  .sim small{opacity:.75;margin-left:3px}
  table.ag{width:100%;border-collapse:collapse;font-size:.92rem}
  table.ag th{text-align:left;font-weight:600;color:#4E6462;border-bottom:2px solid #C9D5D2;padding:6px 8px;font-size:.85rem}
  table.ag td{border-bottom:1px solid #DCE4E2;padding:8px;vertical-align:top}
  .fat{color:#4E6462;font-size:.83rem}
  .st-ok{color:#2F6F2A;font-weight:600}.st-lib{color:#B43C2A;font-weight:600}.st-prox{color:#A87A00;font-weight:600}.st-cin{color:#6B7B79}
  .of{display:grid;grid-template-columns:34px 8px 1fr auto;gap:10px;align-items:center;padding:5px 0;border-bottom:1px dashed #DCE4E2;font-size:.9rem}
  .of:last-child{border-bottom:0}
  .of .n{color:#6B7B79;text-align:right;font-variant-numeric:tabular-nums}
  .of .c{width:8px;height:22px;border-radius:3px}
  .ac{color:#2F6F2A;font-weight:600}.ex{color:#8C9997}
  .subt{font-size:.85rem;font-weight:600;color:#4E6462;margin:10px 0 2px 0}
  .ganhou{background:#E4F0E1;border-radius:8px;padding:0 10px}
  .ganhou .of{border-bottom:0}
  .fim{border-left:4px solid #1D5C63;background:#E6F0EE;padding:8px 12px;border-radius:0 8px 8px 0;margin-top:8px;font-size:.92rem}
  .fim.perdida{border-color:#B43C2A;background:#F7E3DE}
  .bolha{background:#fff;border:1px solid #D3DDDA;border-radius:12px 12px 12px 3px;padding:9px 12px;margin:4px 0;max-width:620px;font-size:.92rem}
  .bolha.eu{margin-left:auto;background:#DCEDE8;border-radius:12px 12px 3px 12px;max-width:260px;text-align:right}
  .barras{display:grid;gap:8px;margin:8px 0}
  .br{display:grid;grid-template-columns:190px 1fr 120px;gap:12px;align-items:center;font-size:.92rem}
  .br .t{height:16px;background:#DCE4E2;border-radius:3px;overflow:hidden}
  .br .t div{height:100%;background:#1D5C63}
  .legenda{font-size:.82rem;color:#4E6462;margin-top:6px}
  .cx-svg{width:100%;height:auto;background:#fff;border:1px solid #D3DDDA;border-radius:10px;margin:6px 0 2px 0}
  .cx-svg .cx-dt{font-size:15px;font-weight:600;fill:#1F2D2B}
  .cx-svg .cx-sub{font-size:12.5px;fill:#6B7B79}
  .cx-svg .cx-rot{font-size:13px;font-weight:600;fill:#1D5C63}
  .cx-svg .cx-n{font-size:12px;font-weight:700;fill:#fff}
  .cx-arco{stroke-dasharray:1200;stroke-dashoffset:1200;animation:cxdesenha .9s ease-out forwards}
  @keyframes cxdesenha{to{stroke-dashoffset:0}}
  .cx-resumo{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin:4px 0 10px 0;font-size:.95rem}
  .cx-tag{padding:2px 10px;border-radius:999px;font-weight:600;font-size:.85rem}
  .cx-tag.ok{background:#E4F0E1;color:#2F6F2A}.cx-tag.perdida{background:#F7E3DE;color:#B43C2A}
  .cx-etapa{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;margin:14px 0 2px 0;font-weight:600}
  .cx-num{width:26px;height:26px;border-radius:50%;background:#1D5C63;color:#fff;display:flex;align-items:center;
          justify-content:center;font-size:.85rem}
  .cx-mov{margin:4px 0 4px 13px;padding:6px 0 6px 22px;border-left:3px solid #1D5C63;font-size:.93rem;color:#1F2D2B}
  .cx-cor{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:baseline}
</style>
""", unsafe_allow_html=True)


# ---------------- dados ----------------
@st.cache_data
def carregar():
    prev = pd.read_csv(SAIDAS / "previsoes.csv", parse_dates=["data_consulta", "data_agendamento"],
                       dtype={"id_paciente": str})
    sint = pd.read_parquet(DADOS / "sinteticos.parquet")
    prev = prev.merge(sint.drop(columns=["id_paciente"]), on="id_consulta", how="left")
    resumo = json.load(open(SAIDAS / "resumo_simulacao.json", encoding="utf-8"))
    placar = pd.read_csv(SAIDAS / "placar.csv") if (SAIDAS / "placar.csv").exists() else pd.DataFrame()
    return prev, resumo, placar


@st.cache_data
def eventos():
    return pd.read_json(SAIDAS / "eventos.jsonl", lines=True)


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


prev, resumo, placar = carregar()

# ---------------- barra lateral ----------------
with st.sidebar:
    st.markdown("### Giro")
    st.caption("Simulação com consultas reais de Vitória (ES), 25/05 a 08/06/2016.")
    valor = st.radio("Valor da consulta", ["Convênio", "SUS"], index=0,
                     help="Convênio: R$ 128–195 por consulta (média R$ 150). SUS: R$ 13,85 por consulta perdida.")
    ev = eventos()
    # dia sugerido ao abrir: o com mais remarcações a partir das vagas liberadas dele (mostra bem a cascata)
    lib0 = ev[(ev.tipo == "vaga_liberada") & (ev.nivel == 0)]
    n_ac = ev[ev.tipo == "aceite"].groupby("raiz").size()
    lib0 = lib0.assign(remarc=lib0.id_consulta.map(n_ac).fillna(0))
    ranking = (lib0.merge(prev[["id_consulta", "data_consulta"]], on="id_consulta")
               .groupby(["unidade", "data_consulta"]).agg(remarc=("remarc", "sum"), vagas=("remarc", "size"))
               .sort_values(["remarc", "vagas"], ascending=False))
    padrao_u, padrao_d = ranking.index[0]
    unidades = sorted(prev["unidade"].unique())
    unidade = st.selectbox("Unidade", unidades, index=unidades.index(padrao_u), format_func=str.title)
    dias = sorted(prev.loc[prev.unidade == unidade, "data_consulta"].dt.date.unique())
    dia = st.selectbox("Dia da consulta", dias, index=dias.index(padrao_d.date()) if padrao_d.date() in dias else 0,
                       format_func=lambda d: d.strftime("%d/%m/%Y"))
    st.markdown('<div class="legenda"><span class="sim">exemplo<small>simulado</small></span> '
                'marca dado sintético (horário, valor, cor de risco, distância e respostas). O resto vem do dataset real.</div>',
                unsafe_allow_html=True)

st.markdown("# Giro")
st.markdown(f'<p class="sub">{escape(unidade.title())} · consultas de {dia.strftime("%d/%m/%Y")}. '
            'Quem tende a faltar recebe contato 3 dias antes; quem diz que não vai libera a vaga para a fila.</p>',
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
with aba1:
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Consultas no dia", len(agenda))
    c2.metric("Contatadas", int(agenda.id_consulta.isin(contatados).sum()))
    vagas_dia = [i for i in agenda.id_consulta if resp.get(i) in ("nao_vou", "remarcar")]
    c3.metric("Vagas liberadas", len(vagas_dia))
    c4.metric("Faltas reais no dia", int(agenda.falta.sum()), help="Do dataset. Usado só para avaliar, nunca mostrado à unidade.")

    ver = st.radio("Mostrar", ["Só quem recebeu contato", "Todas as consultas"], horizontal=True, key="ver_agenda")
    tabela = agenda if ver == "Todas as consultas" else agenda[(agenda.faixa != "BAIXO") | agenda.id_consulta.isin(contatados)]
    aviso_html = '<br><span class="faixa" style="color:#1D5C63;background:#DCEDE8;margin-top:4px">Aviso 60+</span>'
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
        fat = "; ".join(x for x in [r.fator_1, r.fator_2, r.fator_3] if isinstance(x, str) and x)
        linhas.append(
            f"<tr><td>{sim(r.horario)}</td><td>{paciente_curto(r.id_paciente)}<br><span class='fat'>{int(r.idade)} anos · "
            f"{escape(r.perfil_nome)}</span></td><td>{faixa_html(r.faixa)}{aviso_html if r.id_consulta in avisados else ''}</td>"
            f"<td class='fat'>{escape(fat)}</td>"
            f"<td>{status}</td></tr>")
    st.markdown("<table class='ag'><tr><th>Horário</th><th>Paciente</th><th>Risco</th><th>Por quê</th><th>Situação</th></tr>"
                + "".join(linhas) + "</table>", unsafe_allow_html=True)
    st.caption("Alto: 20% de maior risco do dia nesta unidade, recebe pedido de confirmação 3 dias antes. "
               "Médio: os 30% seguintes, recebem lembrete com botão “não vou”. Baixo: sem contato, "
               "exceto pacientes de 60 anos ou mais, que recebem aviso 3 dias antes.")

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
FIM_PONTO = {"fila_sem_horario": ("#3F8F3A", "preenchida pela fila"), "volta_agenda": ("#3F8F3A", "volta à agenda"),
             "perdida": ("#B43C2A", "perdido")}
FIM_CURTO = {"fila_sem_horario": "paciente da fila atendido", "volta_agenda": "volta para a agenda",
             "perdida": "último horário perdido", "nao_preenchida": "não preenchida"}


@st.cache_data
def cascatas_unidade(unidade):
    """Uma linha por cascata (vaga liberada por 'não vou'/'quero remarcar') da unidade."""
    ev = eventos()
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


def ponto_cor(cor):
    return f'<span class="cx-cor" style="background:{COR_SISREG.get(cor, "#999")}"></span>'


def svg_mapa(etapas, fim, passo):
    """Linha do tempo: cada horário livre é um ponto; cada seta é um paciente que antecipou a consulta."""
    datas = [e["data"] for e in etapas]
    d0, d1 = min(datas), max(datas)
    vao = max((d1 - d0).days, 1)
    W, X0, X1, Y = 1000, 70, 930, 150
    x = lambda d: X0 + (X1 - X0) * (d - d0).days / vao if len(set(datas)) > 1 else (X0 + X1) / 2
    partes = [f'<svg viewBox="0 0 {W} 215" class="cx-svg" role="img" aria-label="Mapa da cascata">',
              '<defs><marker id="pt" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
              'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1D5C63"/></marker></defs>',
              f'<line x1="{X0 - 30}" y1="{Y}" x2="{X1 + 30}" y2="{Y}" stroke="#C9D5D2" stroke-width="2"/>']
    # semanas no eixo
    for d in pd.date_range(d0.normalize(), d1.normalize(), freq="W-MON"):
        partes.append(f'<line x1="{x(d):.0f}" y1="{Y - 5}" x2="{x(d):.0f}" y2="{Y + 5}" stroke="#C9D5D2"/>')
    vis = etapas[:passo]
    for k, e in enumerate(vis):
        a = e["aceite"]
        if a is None or k + 1 >= len(etapas) or k + 1 >= passo:
            continue
        xa, xb = x(etapas[k + 1]["data"]), x(e["data"])
        h = 70 + 45 * (k % 2)  # alterna a altura para os rótulos de arcos vizinhos não se sobreporem
        meio = (xa + xb) / 2
        partes.append(f'<path d="M{xa:.0f},{Y - 10} Q{meio:.0f},{Y - h} {xb + 6:.0f},{Y - 12}" fill="none" '
                      f'stroke="#1D5C63" stroke-width="2.5" marker-end="url(#pt)" class="cx-arco"/>')
        dias = (etapas[k + 1]["data"] - e["data"]).days
        ytop = Y - h / 2 - 18  # logo acima do topo da curva
        partes.append(f'<circle cx="{meio - 34:.0f}" cy="{ytop - 5:.0f}" r="10" fill="#1D5C63"/>'
                      f'<text x="{meio - 34:.0f}" y="{ytop:.0f}" text-anchor="middle" class="cx-n">{k + 1}</text>'
                      f'<text x="{meio - 19:.0f}" y="{ytop:.0f}" class="cx-rot">−{plural(dias, "dia", "dias")}</text>')
    for k, e in enumerate(vis):
        final = k == len(etapas) - 1 and passo == len(etapas)
        if k == 0:
            cor, rot = "#B43C2A", "liberada"
        elif final and fim in FIM_PONTO:
            cor, rot = FIM_PONTO[fim]
        else:
            cor, rot = "#1D5C63", "ficou livre"
        xx = x(e["data"])
        partes.append(f'<circle cx="{xx:.0f}" cy="{Y}" r="9" fill="{cor}" stroke="#fff" stroke-width="3"/>')
        partes.append(f'<text x="{xx:.0f}" y="{Y + 30}" text-anchor="middle" class="cx-dt">{e["data"]:%d/%m}</text>')
        partes.append(f'<text x="{xx:.0f}" y="{Y + 48}" text-anchor="middle" class="cx-sub">{escape(rot)}</text>')
    if passo == len(etapas) and fim == "fila_sem_horario":
        xx = x(etapas[-1]["data"])
        partes.append(f'<path d="M{xx:.0f},22 L{xx:.0f},{Y - 14}" stroke="#3F8F3A" stroke-width="2.5" '
                      f'stroke-dasharray="5 4" marker-end="url(#pt)"/>'
                      f'<text x="{xx:.0f}" y="16" text-anchor="middle" class="cx-rot" fill="#3F8F3A">'
                      f'fila da regulação</text>')
    partes.append("</svg>")
    return "".join(partes)


def html_ofertas(ofertas):
    def linha(o, res):
        tipo = "já tem consulta mais tarde" if o.tipo_fila == "A" else "fila sem horário"
        return (f'<div class="of"><span class="n">{int(o.ordem)}º</span>'
                f'<span class="c" style="background:{COR_SISREG[o.cor]}"></span>'
                f'<span>{paciente_curto(o.quem)} · {tipo} · espera {o.espera_dias:.0f} dias · '
                f'{sim(o.cor)} {sim(f"{o.distancia_km:.1f} km")}</span>{res}</div>')
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
            h.append(f'<div class="of"><span class="n">…</span><span></span>'
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
                mov = (f'{ponto_cor(a.cor)}<b>{paciente_curto(a.quem)}</b> aceitou na {int(e["ofertas"].ordem.max())}ª '
                       f'oferta e antecipou a consulta de <b>{pd.Timestamp(a.dia_antigo):%d/%m}</b> para '
                       f'<b>{e["data"]:%d/%m}</b>: <b>{plural(dias, "dia", "dias")}</b> antes. '
                       f'Esperava havia {plural(int(a.espera_dias), "dia", "dias")}.')
            else:
                mov = (f'{ponto_cor(a.cor)}<b>{paciente_curto(a.quem)}</b>, que não tinha horário marcado, aceitou na '
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
    todas = cascatas_unidade(unidade)
    do_dia = todas[todas.data_consulta == dia_ts]
    if todas.empty:
        st.info("Nenhuma vaga foi liberada nesta unidade no período. Escolha outra unidade na barra lateral.")
    else:
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Vagas liberadas na unidade", len(todas))
        c2.metric("Com remarcação", int((todas.remarcacoes > 0).sum()),
                  f"{(todas.remarcacoes > 0).mean():.0%} das liberadas".replace(".", ","), delta_color="off")
        c3.metric("Pacientes que mudaram de horário", int(todas.remarcacoes.sum()))
        c4.metric("Maior cascata", f"{int(todas.remarcacoes.max())} remarcações")

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
        st.caption("Ordem da fila: cor de risco (vermelho, amarelo, verde, azul) e, dentro da cor, quem espera há mais "
                   "tempo. Quem já tem consulta só recebe oferta se ela estiver a 5+ dias úteis.")

# ---------------- Painel ----------------
with aba4:
    r = resumo["produto"]
    ctl = resumo.get("aleatorio")
    st.markdown(f"#### Período inteiro · {r['unidades']} unidades · {r['dias_uteis']} dias úteis · {r['consultas']:,} consultas".replace(",", "."))
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Faltas no período", f"{r['faltas']:,}".replace(",", "."))
    c2.metric("Vagas liberadas", f"{r['vagas_liberadas']:,}".replace(",", "."))
    c3.metric("Vagas recuperadas", f"{r['vagas_recuperadas']:,}".replace(",", "."),
              help="Só conta quando a cadeia termina num paciente da fila sem horário ou num horário que volta à agenda (D25).")
    if valor == "Convênio":
        c4.metric("Receita recuperada", brl(r["valor_recuperado_convenio"]), f"{r['M9']:.1%} da perda".replace(".", ","))
    else:
        c4.metric("Pacientes da fila atendidos", r["pacientes_b_atendidos"],
                  f"+ {r['dias_antecipados_tipo_a']:,.0f} dias antecipados".replace(",", "."))

    st.markdown("#### Comparação")
    chave = "valor_recuperado_convenio" if valor == "Convênio" else "vagas_recuperadas"
    linhas = [("Sem o produto", 0), ("Contato sorteado, sem modelo", ctl[chave] if ctl else 0), ("Giro", r[chave])]
    maior = max(v for _, v in linhas) or 1
    fmt = brl if valor == "Convênio" else (lambda v: f"{v:,.0f} vagas".replace(",", "."))
    st.markdown('<div class="barras">' + "".join(
        f'<div class="br"><span>{n}</span><div class="t"><div style="width:{100*v/maior:.0f}%"></div></div><span>{fmt(v)}</span></div>'
        for n, v in linhas) + "</div>", unsafe_allow_html=True)
    if valor == "Convênio":
        st.caption(f"Cerca de {brl(r['por_unidade_mes_convenio'])} por unidade por mês. "
                   f"O sorteio usa as mesmas quantidades de contato, sem o modelo.")
    else:
        st.caption(f"No SUS o valor por consulta é baixo ({brl(r['valor_recuperado_sus'])} no período); "
                   "o ganho é a fila andar: pacientes atendidos antes.")

    st.markdown("#### Quem ganhou as vagas")
    c1, c2, c3 = st.columns(3)
    c1.metric("Espera média dos beneficiados", f"{r['espera_media_beneficiados']:.0f} dias")
    c2.metric("Urgentes (vermelho ou amarelo)", f"{r['urgentes_beneficiados']:.0%}", help="São 20% da fila.")
    c3.metric("Primeira vaga preenchida", f"{r['M8']:.1%}".replace(".", ","),
              help="Desta rodada (semente 42). O placar usa a média de 5 sementes. M8, meta 45%.")

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
