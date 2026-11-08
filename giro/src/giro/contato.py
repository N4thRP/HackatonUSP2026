"""Contato com o paciente: quem recebe, qual mensagem e qual resposta (simulada)."""
import numpy as np

BOTOES = ["Vou", "Não vou", "Quero remarcar"]


def mensagem(nome_unidade, data, hora, faixa, perfil):
    data_txt = data.strftime("%d/%m")
    if faixa == "ALTO":
        texto = f"Olá! Sua consulta é dia {data_txt}, às {hora}, na Unidade {nome_unidade.title()}. Você vai conseguir comparecer?"
    else:
        texto = f"Lembrete: sua consulta é dia {data_txt}, às {hora}, na Unidade {nome_unidade.title()}. Se não puder ir, avise por aqui."
    if perfil == "P2":
        texto += " Sem problema se não puder: avisando, liberamos o horário para outra pessoa."
    if perfil == "P5":
        texto = "Para o responsável: " + texto
    if perfil == "P3":
        texto += " Primeira vez? Leve documento e cartão do SUS."
    return texto


def sortear_resposta(rng, faixa, faltou, params):
    """Resposta ligada ao resultado real da consulta (D22). MÉDIO e aviso a idosos usam a resposta menor (D26, D31)."""
    tabela = params["alto" if faixa == "ALTO" else "medio"]["faltou" if faltou else "foi"]
    opcoes = list(tabela)
    return opcoes[rng.choice(len(opcoes), p=np.array([tabela[o] for o in opcoes]))]
