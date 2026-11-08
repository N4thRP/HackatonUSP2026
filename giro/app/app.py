"""Giro — interface do MVP (Streamlit, D20)."""
import json
import sys
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
  .st-ok{color:#2F6F2A;font-weight:600}.st-lib{color:#B43C2A;font-weight:600}.st-cin{color:#6B7B79}
  .elo{display:grid;grid-template-columns:8px 1fr;gap:12px;margin:0 0 4px 0}
  .elo .barra{border-radius:4px}
  .vaga{background:#fff;border:1px solid #D3DDDA;border-radius:10px;padding:12px 14px;margin:6px 0}
  .vaga h4{margin:0 0 4px 0;font-size:1rem}
  .of{display:grid;grid-template-columns:34px 8px 1fr auto;gap:10px;align-items:center;padding:5px 0;border-bottom:1px dashed #DCE4E2;font-size:.9rem}
  .of:last-child{border-bottom:0}
  .of .n{color:#6B7B79;text-align:right;font-variant-numeric:tabular-nums}
  .of .c{width:8px;height:22px;border-radius:3px}
  .ac{color:#2F6F2A;font-weight:600}.ex{color:#8C9997}
  .subt{font-size:.85rem;font-weight:600;color:#4E6462;margin:10px 0 2px 0}
  .ganhou{background:#E4F0E1;border-radius:8px;padding:0 10px}
  .ganhou .of{border-bottom:0}
  .seta{margin:2px 0 2px 18px;color:#1D5C63;font-size:.9rem}
  .fim{border-left:4px solid #1D5C63;background:#E6F0EE;padding:8px 12px;border-radius:0 8px 8px 0;margin-top:8px;font-size:.92rem}
  .fim.perdida{border-color:#B43C2A;background:#F7E3DE}
  .bolha{background:#fff;border:1px solid #D3DDDA;border-radius:12px 12px 12px 3px;padding:9px 12px;margin:4px 0;max-width:620px;font-size:.92rem}
  .bolha.eu{margin-left:auto;background:#DCEDE8;border-radius:12px 12px 3px 12px;max-width:260px;text-align:right}
  .barras{display:grid;gap:8px;margin:8px 0}
  .br{display:grid;grid-template-columns:190px 1fr 120px;gap:12px;align-items:center;font-size:.92rem}
  .br .t{height:16px;background:#DCE4E2;border-radius:3px;overflow:hidden}
  .br .t div{height:100%;background:#1D5C63}
  .legenda{font-size:.82rem;color:#4E6462;margin-top:6px}
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
    lib0 = ev[(ev.tipo == "vaga_liberada") & (ev.nivel == 0)]
    ranking = lib0.merge(prev[["id_consulta", "data_consulta"]], on="id_consulta").groupby(["unidade", "data_consulta"]).size()
    padrao_u, padrao_d = ranking.idxmax()
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
with aba3:
    raizes = [i for i in agenda.id_consulta if resp.get(i) in ("nao_vou", "remarcar")]
    if not raizes:
        st.info("Nenhuma vaga foi liberada neste dia. Escolha outro dia na barra lateral; o dia sugerido ao abrir é o com mais vagas.")
    else:
        rotulos = {}
        for rid in raizes:
            l = agenda[agenda.id_consulta == rid].iloc[0]
            rotulos[rid] = f"{l.horario} · {paciente_curto(l.id_paciente)} ({RESPOSTA[resp[rid]].lower()})"
        preenchidas = set(ev_u.loc[(ev_u.tipo == "aceite") & (ev_u.nivel == 0), "raiz"].astype(int))
        com_oferta = set(ev_u.loc[(ev_u.tipo == "oferta") & (ev_u.nivel == 0), "raiz"].astype(int))
        raizes = sorted(raizes, key=lambda x: (x not in preenchidas, x not in com_oferta))
        for x in raizes:
            if x in preenchidas:
                rotulos[x] += " · preenchida"
        rid = st.selectbox("Vaga liberada", raizes, format_func=lambda x: rotulos[x])
        cadeia = ev_u[ev_u.raiz == rid].sort_values(["t", "nivel"])
        reais = cadeia[cadeia.tipo.isin(["oferta", "aceite"])
                       | ((cadeia.tipo == "fim_cadeia") & (cadeia.resultado != "fila_sem_horario"))]
        niveis = sorted(set(reais.nivel.dropna().astype(int)) | {0})
        passo = st.select_slider("Avançar a cascata", options=list(range(len(niveis) + 1)), value=len(niveis),
                                 format_func=lambda k: "início" if k == 0 else f"etapa {k} de {len(niveis)}")
        l0 = agenda[agenda.id_consulta == rid].iloc[0]
        st.markdown(f'<div class="vaga"><h4>Vaga de {dia.strftime("%d/%m")} às {l0.horario} {sim("horário")}</h4>'
                    f'Liberada porque o paciente respondeu “{RESPOSTA[resp[rid]]}”. '
                    f'Vale {brl(l0.valor_convenio) if valor == "Convênio" else "R$ 13,85"} '
                    f'{sim("valor")}.</div>', unsafe_allow_html=True)
        for nv in niveis[:passo]:
            bloco = cadeia[cadeia.nivel == nv]
            html = ['<div class="vaga">']
            ofertas = bloco[bloco.tipo == "oferta"]
            if nv > 0:
                html.append(f"<h4>Nível {nv}: o horário antigo de quem aceitou é oferecido à fila</h4>")
            else:
                html.append("<h4>Ofertas da vaga para a fila de espera</h4>")

            def linha_oferta(o, res):
                tipo = "já tem consulta mais tarde" if o.tipo_fila == "A" else "fila sem horário"
                return (f'<div class="of"><span class="n">{int(o.ordem)}º</span>'
                        f'<span class="c" style="background:{COR_SISREG[o.cor]}"></span>'
                        f'<span>{paciente_curto(o.quem)} · {tipo} · espera {o.espera_dias:.0f} dias · '
                        f'{sim(o.cor)} {sim(f"{o.distancia_km:.1f} km")}</span>{res}</div>')

            if len(ofertas):
                sem_resp = ofertas[ofertas.resultado != "aceite"]
                aceitou = ofertas[ofertas.resultado == "aceite"]
                if len(sem_resp):
                    html.append(f'<div class="subt">Sem resposta em 30 min ({len(sem_resp)})</div>')
                    mostrar = sem_resp if len(sem_resp) <= 8 else sem_resp.head(6)
                    for o in mostrar.itertuples():
                        html.append(linha_oferta(o, '<span class="ex">não respondeu</span>'))
                    if len(sem_resp) > 8:
                        html.append(f'<div class="of"><span class="n">…</span><span></span>'
                                    f'<span class="ex">mais {len(sem_resp) - 6} ofertas sem resposta</span><span></span></div>')
                if len(aceitou):
                    html.append('<div class="subt">Ficou com a vaga</div><div class="ganhou">'
                                + linha_oferta(aceitou.iloc[0], '<span class="ac">aceitou</span>') + "</div>")
                else:
                    # Ofertas vão até 2 h antes do dia da vaga (fim em vaga_dia * OFERTAS_POR_DIA, D19).
                    ult = ofertas.iloc[-1]
                    if ult.t + 1 < ult.vaga_dia * OFERTAS_POR_DIA:
                        html.append('<div class="subt">Ninguém aceitou e a fila acabou: não havia mais '
                                    'ninguém elegível para receber a oferta</div>')
                    else:
                        html.append('<div class="subt">Ninguém aceitou antes do prazo (até 2 h antes da consulta)</div>')
            else:
                html.append('<p class="ex" style="margin:4px 0">Nenhuma oferta enviada: não havia ninguém elegível na fila '
                            'nesse momento (mesma unidade, consulta a 5+ dias úteis de hoje ou fila sem horário) '
                            'ou não sobrou tempo antes do prazo.</p>')
            ac = bloco[bloco.tipo == "aceite"]
            if len(ac):
                a = ac.iloc[0]
                antes = f", que tinha consulta em {pd.Timestamp(a.dia_antigo).strftime('%d/%m')}" if isinstance(a.dia_antigo, str) else ""
                html.append(f'<div class="seta">↓ {paciente_curto(a.quem)} ficou com a vaga{antes}.</div>')
            html.append("</div>")
            st.markdown("".join(html), unsafe_allow_html=True)
        fins = cadeia[cadeia.tipo == "fim_cadeia"]
        if passo == len(niveis) and len(fins):
            r = fins.iloc[-1].resultado
            texto = {"fila_sem_horario": "Cadeia terminou com um paciente da fila da regulação: uma vaga a mais na unidade.",
                     "volta_agenda": "O último horário livre está a 5+ dias úteis e volta para a agenda normal: vaga recuperada.",
                     "perdida": "O último horário ficou perto demais para alguém marcar e se perdeu.",
                     "nao_preenchida": "Ninguém da fila aceitou; a vaga não foi preenchida."}[r]
            ok = r in ("fila_sem_horario", "volta_agenda")
            st.markdown(f'<div class="fim {"" if ok else "perdida"}">{texto}</div>', unsafe_allow_html=True)
        st.caption("Ordem da fila: cor de risco (vermelho, amarelo, verde, azul) e, dentro da cor, quem espera há mais tempo. "
                   "Quem já tem consulta só recebe oferta se ela estiver a 5+ dias úteis.")

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
        linhas = []
        for k, nome, op, meta, fmt in metas:
            v = ult[k]
            try:
                v = float(v)
                ok = v >= meta if op == ">=" else v <= meta
                txt = fmt.format(v)
            except (TypeError, ValueError):
                ok, txt = v == meta, str(v)
            meta_txt = fmt.format(meta) if not isinstance(meta, str) else meta
            linhas.append(f"<tr><td>{k}</td><td>{nome}</td><td>{ {'>=': '≥', '<=': '≤'}.get(op, op)} {meta_txt}</td><td>{txt}</td>"
                          f"<td class='{'st-ok' if ok else 'st-lib'}'>{'atingida' if ok else 'abaixo'}</td></tr>")
        st.markdown("<table class='ag'><tr><th></th><th>Métrica</th><th>Meta</th><th>Resultado</th><th></th></tr>"
                    + "".join(linhas) + "</table>", unsafe_allow_html=True)
        if "M5a" in ult and pd.notna(ult["M5a"]):
            st.caption(f"Informativo · M5a, ordenação do modelo entre grupos: {float(ult['M5a']):.1f} p.p. "
                       "(medida antiga da M5, mantida por transparência).")
        st.caption(f"Versão {ult['versao']}, medida em {ult['data']}. M8 e M9 são a média de 5 sementes. "
                   f"{ult['nota']}. Histórico completo em saidas/placar.csv.")
