# Giro — MVP

Prevê quem tende a faltar à consulta, contata o paciente 3 dias antes (faixas Alto e Médio, mais um aviso para quem tem 60+) e, quando ele responde que não vai, oferece a vaga à lista de espera: no SUS, quem espera há mais tempo (D34); em hospital particular, primeiro quem tem consulta uma semana depois no mesmo horário (D35). Cobrança: no mercado privado, coparticipação (D36), em que o Giro fica com um percentual da receita das consultas recuperadas e só ganha quando a clínica ganha; no SUS, assinatura fixa por unidade (D37). Hackathon USP · Saúde para todos.

## Como rodar

```bash
pip install -r requirements.txt
python rodar_tudo.py            # prepara, treina, avalia, simula, testa e grava o placar (~30 s)
streamlit run app/app.py        # abre a interface em http://localhost:8501
```

Passo a passo, se quiser rodar separado:

| Ordem | Comando | O que faz |
|---|---|---|
| 1 | `python preparar.py` | Limpa o dataset de Vitória, cria variáveis, perfis P1–P6 e dados sintéticos |
| 2 | `python treinar.py` | Treina o modelo e gera previsões, faixas e fatores do período de teste |
| 3 | `python avaliar.py` | Mede M1–M5 |
| 4 | `python simular.py` | Simula contato e cascata com ofertas sequenciais (D11) nas duas regras de realocação — geral/SUS (D34, tempo de espera) e particular (D35, mesmo horário uma semana depois) — mais o controle sem modelo; mede M6, M8–M10 |
| 5 | `python -m pytest` | Testes de M6, M7, M11, M12 |

## Estrutura

```
config/fontes.yaml     parâmetros sintéticos e a fonte de cada um
config/regras.yaml     regras aprovadas (faixas, D-3, guarda, carência)
dados/brutos/          vitoria.csv (treino) e itajai.csv (só horários)
src/giro/          preparar, sinteticos, modelo, contato, lista_espera, simulador, metricas
app/app.py             interface Streamlit (Agenda, Contatos, Realocação, Painel)
app/mapa.json          contorno de Vitória (IBGE) e centro de cada bairro (OpenStreetMap), para o mapa da barra lateral
tests/                 testes automáticos
saidas/                modelo, previsões, eventos da simulação, resumo e placar
```

## O que é real e o que é simulado

Real (dataset de Vitória, 2016): pacientes, datas, antecedência, histórico, condições de saúde, unidade e se faltou.
Simulado (com semente fixa, ver `config/fontes.yaml`): horário, valor da consulta, distância, respostas às mensagens, aceite das ofertas e a fila da regulação sem horário. Campos simulados nunca entram no modelo e aparecem com o selo "simulado" na interface.

## Opções em `config/regras.yaml`

- `aviso_idosos`: aviso 3 dias antes para pacientes de 60+ que ficaram na faixa Baixo (D31)
- `faixa_por_idade: true` corta as faixas dentro de cada faixa etária (alternativa à D31, custa ~2,5 p.p. de recall)

## Placar

`saidas/placar.csv` guarda uma linha por versão. M8 e M9 são a média de 5 sementes (faixa na coluna `nota`). M5 mede a diferença, entre grupos, na chance de quem faltaria receber contato (D32); M5a guarda a medida antiga (ordenação do modelo), só para referência.
