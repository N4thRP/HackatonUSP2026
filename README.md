# Giro · Previsão de no-show e realocação de consultas

> **Hackathon USP 2026 · Tema: Saúde para todos, soluções para reduzir barreiras no acesso à saúde**

**Giro** prevê quais pacientes têm maior chance de faltar a uma consulta, entra em contato com eles antes da data e, quando o paciente confirma que não vai, **oferece o horário a quem está na lista de espera**. A vaga que ficaria vazia passa a atender quem espera.

**Prever → Contatar → Realocar**

---

## O problema

- O paciente espera semanas (às vezes anos) por uma consulta especializada, enquanto horários ficam vazios porque alguém faltou sem avisar.
- A unidade de saúde mantém médico, sala e equipe parados e perde receita a cada falta.
- A equipe de agendamento confirma por telefone sem saber em quem focar.
- Na literatura, o absenteísmo em consultas especializadas do SUS passa de 38% na Região Metropolitana do Espírito Santo (Beltrame et al., 2019).

## Como funciona

O MVP roda um ciclo por dia, para cada unidade:

| Etapa | O que acontece |
|-------|----------------|
| **1. Prever** | Três dias antes (D-3), o modelo calcula o risco de falta de cada consulta e a classifica em faixa **ALTO** (20% de maior risco do dia), **MÉDIO** (próximos 30%) ou **BAIXO**. |
| **2. Contatar** | ALTO recebe pedido de confirmação; MÉDIO recebe lembrete com botão "não vou". Pacientes de 60+ na faixa BAIXO também recebem aviso, por equidade. |
| **3. Ouvir** | "Vou" confirma. "Não vou" ou "Quero remarcar" libera a vaga. **Nenhuma vaga é liberada sem resposta ativa do paciente.** |
| **4. Ofertar** | A vaga vai para a lista de espera, **um paciente por vez**, com 30 minutos para responder. No SUS, a ordem é por tempo de espera; em hospital particular, primeiro quem tem consulta uma semana depois no mesmo horário. |
| **5. Encaixar** | Quem aceita é movido, e o horário que deixou vago volta ao ciclo (cascata). |

## Resultados do MVP

Simulação no período de teste (25/05 a 08/06/2016), média de 5 sementes.

### Modelo (conjunto de teste temporal)

| Métrica | Resultado |
|---------|-----------|
| AUC-ROC | **0,743** |
| Precisão nos 20% de maior risco | **36,9%** (cerca de 2× a taxa base) |
| Recall nos 20% de maior risco | **39,6%** |
| Erro de calibração (ECE) | **0,028** |

### Realocação (simulação)

| Métrica | Resultado |
|---------|-----------|
| Vagas liberadas reocupadas (M8) | **44,5%** (referência de mercado: 42% a 48%) |
| Receita perdida recuperada (M9) | **16,6%** |
| Receita recuperada por unidade, cenário convênio | cerca de **R$ 5,8 mil por mês** |
| Espera média de quem ganhou a vaga | 25 dias |
| Vagas liberadas sem resposta ativa | **0** |

Com o mesmo volume de contatos sorteado, sem modelo, a recuperação de receita é cerca de 35% menor.

### Metas que não foram atingidas

- **AUC-ROC ≥ 0,75:** ficou em 0,743, que parece ser o teto do dataset.
- **Recall no top 20% ≥ 40%:** ficou em 39,6%.
- **Equidade (M5):** a diferença de cobertura de contato entre grupos (idade, sexo e Bolsa Família) caiu para 27,5 p.p., acima da meta de 10 p.p. A faixa de 40 a 59 anos é a menos coberta (72%).

## Dados

| Fonte | Uso |
|-------|-----|
| **Vitória (ES), Kaggle 2016**: 110.521 consultas válidas, 62 mil pacientes, 81 unidades | Treino e teste do modelo |
| **Itajaí (SC)**: 49.593 atendimentos | Distribuição de horários e motivos de falta, só na simulação |
| Beltrame et al. (2019), Farias et al. (2019), APM 2025, Luma Health | Valor por consulta, espera na fila e regras de realocação |

**Dados sintéticos.** O dataset de Vitória não tem horário, distância nem valor da consulta. Esses campos são **gerados com semente fixa**, a partir das fontes acima, e aparecem na interface com o selo **"simulado"**. Regra do projeto: **campos sintéticos nunca entram no treino nem na avaliação do modelo**, só na simulação. Um teste automático verifica isso.

## Modelo

- **Gradient boosting** (scikit-learn), com a explicação dos 3 fatores que mais pesaram em cada previsão.
- **Validação temporal:** treino até 24/05/2016 e teste a partir de 25/05, como o produto seria usado (prever o futuro com o passado).
- **Sem vazamento do futuro:** o histórico de cada paciente usa apenas consultas anteriores ao agendamento.
- **Variáveis:** antecedência do agendamento (a mais forte), histórico de faltas, dias desde a última consulta, consultas no mesmo dia ou semana, taxa de faltas da unidade, idade e condições de saúde. A variável `SMS_received` foi descartada por estar confundida com a antecedência.

## Estrutura do código

```
giro/
├── config/          # parâmetros sintéticos (com a fonte de cada um) e regras
├── src/giro/
│   ├── preparar.py      # limpeza, variáveis e perfis de pacientes
│   ├── sinteticos.py    # horário, valor, distância e respostas simuladas
│   ├── modelo.py        # treino, previsão, faixa de risco e fatores
│   ├── contato.py       # fila de contato, mensagens e respostas
│   ├── lista_espera.py  # elegibilidade, ordem das ofertas e cascata
│   ├── simulador.py     # ciclo diário e log de eventos
│   └── metricas.py      # métricas M1 a M12
├── app/app.py       # interface em Streamlit
└── tests/           # 18 testes automatizados (pytest)
```

## Como rodar

```bash
python rodar_tudo.py          # prepara os dados, treina, avalia e simula (cerca de 30 s)
streamlit run app/app.py      # abre a interface
pytest                        # roda os testes
```

A interface tem as abas **Agenda**, **Contatos**, **Realocação** e **Painel**, com botões para alternar o modo de oferta (sequencial ou simultânea) e o cenário de valor (convênio ou SUS).

## Decisões de projeto

- **Resposta ativa obrigatória:** a previsão sozinha nunca cancela uma consulta.
- **Fila por tempo de espera:** a urgência clínica ficou fora, por ser sintética e subjetiva.
- **Oferta sequencial como padrão:** a simultânea recupera mais vagas (61% das liberadas), mas não respeita a ordem da fila.
- **Modelo de cobrança proposto:** coparticipação sobre a receita recuperada no mercado privado e assinatura por unidade no SUS.

## Limitações

- Os dados reais de treino são de 2016, de uma única cidade.
- O contato com o paciente e a resposta são **simulados**, sem integração com WhatsApp, SMS ou prontuário.
- Os resultados de realocação dependem de parâmetros sintéticos, e alguns são hipóteses documentadas, não dados medidos.
- A equidade por idade ainda não atinge a meta.

## Fontes

- Beltrame et al., *Saúde em Debate* (2019): [artigo](https://www.scielo.br/j/sdeb/a/BYJbCp6ZBz9NCynKt3h3X3J/?lang=pt)
- Farias et al., *Saúde em Debate* (2019): [artigo](https://www.scielosp.org/article/sdeb/2019.v43nspe5/190-204/)
- Luma Health, Smart Waitlist: [produto](https://www.lumahealth.io/product/smart-waitlist/)
- Dataset de Vitória (ES): Medical Appointment No Shows, Kaggle
