# Ciclo Azul

PWA para celular que monitora o consumo de água dos sistemas de refrigeração e rastreia a destinação de resíduos químicos e de metais pesados em data centers (ODS 6). Esta etapa é só o **frontend**: HTML, CSS e JavaScript puro (módulos ES), sem build e sem dependências. Os dados são simulados e ficam no `localStorage`.

**Visual:** tema claro, 3 cores (azul, vermelho e cinza), sem gradientes, sem animações, cantos de no máximo 4px. Estados nunca dependem só de cor: toda etiqueta tem ícone e texto.

## Rodar

```bash
python3 -m http.server 8123     # ou: npx serve .
# abra http://localhost:8123 (no celular, use o IP da máquina na mesma rede)
```

É preciso um servidor HTTP: módulos ES e service worker não funcionam em `file://`. Para instalar como app, use o menu do navegador ("Instalar" / "Adicionar à tela inicial"). Com o service worker o app abre offline.

### Contas de demonstração (senha `ciclo123`)

| Nível de acesso | E-mail |
|---|---|
| Administrador | ana@ciclo.azul |
| Gestor Ambiental | marina@ciclo.azul · rafael@ciclo.azul (dois gestores, para testar a dupla confirmação) |
| Operador | diego@ciclo.azul (DC São Paulo 1 e Campinas) · paulo@ciclo.azul (DC Fortaleza) |
| Diretoria | helena@ciclo.azul |

A tela de login tem atalhos que preenchem as credenciais. "Restaurar dados de demonstração" fica em Minha conta (botão com as iniciais, no topo).

## Estrutura

```
index.html · manifest.webmanifest · sw.js
assets/icons/           ícones (scripts/generate-icons.mjs)
src/css/                base (cores e reset) · layout · components
src/js/
  main.js               rotas e inicialização
  core/                 html (template seguro) · wire (eventos) · router · store · format
  config/permissions.js níveis de acesso, permissões e menu
  data/seed.js          dados fictícios
  services/             auth · audit · telemetry · alerts · waste · insights · kpis · reports
  components/           shell · dialog · charts · icons · ui
  views/                uma tela por arquivo
```

Cada tela exporta `{ title, render, actions, forms, changes, start, stop }`. O HTML usa `data-action`, `data-form` e `data-change`, e `core/wire.js` liga os eventos uma única vez, então a tela pode ser redesenhada sem acumular ouvintes.

## Requisitos

| Requisito | Onde |
|---|---|
| R01 usuários e níveis de acesso | `views/users.js`: o Administrador define nível, status e, para Operador, as unidades; a matriz de permissões é só de leitura |
| R02 oportunidades de reuso (Gestor) | `views/insights.js`, `services/insights.js`, calculadas sobre o histórico de cada unidade |
| R03 / RN03 limites e alertas | `views/water.js`, `services/alerts.js`: alerta ao Gestor e ao Operador **responsável pela unidade** (80% e 100%) |
| R04 sensores e leitura manual (Operador) | `views/sensors.js`, `services/readings.js`: só nas unidades do Operador; leitura manual bloqueada onde há sensor online |
| R05 monitoramento em tempo real | `views/water.js`, `services/telemetry.js` |
| R06 / R07 | `views/waste.js`, `services/waste.js`: local, empresa, licença, data, quantidade e comprovante |
| R08 lotes sem destinação | `services/alerts.js` (vencido e a vencer em 5 dias), só para o Gestor |
| R09 relatórios | `views/reports.js`: PDF (impressão) e CSV |
| R10 KPIs da Diretoria | `views/dashboard.js`, `services/kpis.js` |
| RN01 comprovante | `registerDestination` bloqueia sem arquivo |
| RN02 licença válida na data | `validateDestination` bloqueia empresa com licença vencida |
| RN04 segundo usuário | `confirmDestination`: outro Gestor, diferente de quem registrou ou retificou |
| RN05 só Gestor e Diretoria veem a destinação | permissão `waste.view`; a auditoria não registra empresa, local nem licença |
| RNF01 acesso por perfil | `services/auth.js` e guarda de rotas. Criptografia em trânsito e em repouso e LGPD ficam no backend/infraestrutura |
| RNF02 histórico sem exclusão, retificação justificada | `services/audit.js` (só inclui); leituras e destinações são retificadas com justificativa e o valor original fica no histórico |
| RNF03 API e formatos abertos | exemplo de ingestão ao conectar sensor; exportação em PDF/CSV de relatórios, auditoria e histórico de consumo |

### Quem acessa o quê

| Nível | Telas |
|---|---|
| Administrador | Painel, Usuários, Auditoria |
| Gestor Ambiental | Painel, Água, Resíduos, Reuso, Relatórios e alertas |
| Operador | Painel, Água, Sensores e alertas das suas unidades |
| Diretoria | Painel e Resíduos (somente leitura) |

## O que vira regra do backend

O frontend repete as regras só para dar feedback imediato. Devem ser aplicadas e verificadas no servidor: autenticação e permissões (`auth.js`), RN01, RN02, RN04 e RN05 (`waste.js`), imutabilidade da auditoria (`audit.js`), cálculo de alertas (`alerts.js`), ingestão dos sensores (`telemetry.js`) e geração de relatórios (`reports.js`). Trocar os dados simulados por API significa reescrever `services/*` e `core/store.js`; as telas continuam iguais.

## Decisões e pontos em aberto

- **Auditoria:** o Administrador é quem a consulta (a tabela não diz quem). O Gestor não tem acesso.
- **Retificação em lote perigoso:** quem retifica passa a ser o "registrante" e outro Gestor precisa confirmar de novo (aplica o RN04 à alteração).
- **Quantidade destinada** pode diferir da do lote (pesagem do receptor); a diferença fica visível e a retificação preserva o valor anterior.
- **Alertas além da tabela:** aviso a 80% do limite, sensor offline e licença de empresa perto do vencimento (só Gestor/Operador, conforme a unidade).
- **Permissões fixas por nível.** O Administrador atribui o nível, não edita o que cada nível pode fazer. Se R01 exigir isso, a mudança é local (`config/permissions.js` + `views/users.js`).
- **Telemetria simulada em tempo acelerado:** cada atualização de 2 s equivale a 4 min. "Simular pico" em Água faz o limite estourar em cerca de 30 s.
- **Login de protótipo:** todos usam a senha de demonstração e a sessão fica no `localStorage`.
- **Comprovantes:** só nome e tamanho do arquivo são guardados.
- Ao criar arquivos em `src/`, inclua-os em `ASSETS` no `sw.js` e incremente `CACHE`.
