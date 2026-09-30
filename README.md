# Ecos de Asterion: As Cinzas do Primeiro Reino

RPG de ação single-player em desenvolvimento, feito com Phaser 3, TypeScript e Vite. Esta etapa amplia o núcleo jogável com inventário, equipamento, atributos, progressão, loot, salvamento local e viagens entre regiões.

## Requisitos

- Node.js 20 ou superior
- npm

## Executar

```sh
npm install
npm run dev
```

Abra o endereço local indicado pelo Vite. Para validar a compilação de produção:

```sh
npm run build
npm run preview
npm run test
```

## Controles

- `Enter`: iniciar/continuar pela tela de título
- `WASD` ou setas: mover
- `Shift`: correr, consumindo vigor
- `Espaço`: esquiva com invulnerabilidade breve e custo de vigor
- `J` ou clique esquerdo: golpe corpo a corpo
- `K` ou clique direito: pulso de éter em área, consumindo mana
- `F`: abrir baú ou coletar loot próximo
- `E`: entrar/voltar por um portal próximo
- `Q`: usar uma poção de vida
- `Tab`: inventário e equipamento
- `C`: atributos e estatísticas do personagem
- `Esc`: fechar o menu
- Clique esquerdo/direito: golpe/pulso de éter
- Botão de nota musical: ativar/desativar efeitos sonoros sintetizados
- No inventário, use os botões para equipar, desequipar, consumir, largar, filtrar e comparar itens. Os três espaços de save ficam na parte inferior da mochila.

## O que está implementado

Cinco regiões com portais nos lados norte, sul, leste e oeste, fade, nome e faixa recomendada; o portal de entrada retorna à região anterior. Cada travessia aumenta a pressão persistida da Ruptura (até 25), que eleva o nível dos inimigos. Ao reentrar numa região, seus inimigos derrotados reaparecem sem restaurar os de outras áreas. Cada mundo recebe uma seed e cada região deriva uma seed estável: caminhos sinuosos, clareiras, árvores, rochas, casas, ruínas, cavernas, lagos, pontes, acampamentos, segredos, baús e spawns variam entre partidas e se reconstroem iguais ao carregar. A validação BFS mantém entradas, saídas e pontos de missão/NPC/chefe reservados alcançáveis; os baús abertos são salvos por região. Kael pode receber XP por derrotas e descobertas, subir até o nível 50, distribuir três pontos de atributo por nível e receber um ponto de habilidade a cada cinco níveis. Força, destreza, inteligência, vitalidade, resistência e sorte alteram dano, defesa, recursos, velocidade de ataque, crítico, esquiva, carga e loot.

Inventário visual com categorias, raridades, peso, comparação, dez slots de equipamento, poções/comida, ouro e itens que aparecem no chão. O save versionado grava autosave e três slots manuais em `localStorage`, incluindo seed do mundo/regiões, baús e segredos descobertos, posição, atributos, inventário, equipamento, ouro e inimigos derrotados. O HUD inclui barras de vida, mana, vigor e XP, ouro, minimapa, atalho de poção e telas responsivas. Onze testes exercitam progressão, atributos, equipamento, saves, acessibilidade e 40 layouts de região/seed.

## Estrutura

- `src/main.ts`: inicialização de Phaser e eventos da interface
- `src/game/TitleScene.ts`: paisagem de título e partículas de cinza
- `src/game/GameScene.ts`: mapa, movimento, colisão, inimigos e combate
- `public/assets/kael-idle.svg`, `kael-run.svg`, `kael-attack.svg`: poses do protagonista
- `src/game/world-generation.ts`: geração determinística, estruturas e validação BFS dos mapas
- `src/game/systems.ts`: dados de itens/regiões, fórmulas, inventário e save
- `src/game/character-menu.ts`: renderização das abas do personagem
- `src/game/systems.test.ts`: testes unitários dos sistemas de progressão
- `src/game/character-menu.css`: estilos do menu e controles responsivos
- `src/style.css`: HUD e layout adaptável
- `index.html`: estrutura da interface

## Ainda não implementado

A campanha e a narrativa completas, NPCs/chefes ativos, diálogos/decisões, missões, companheiros, lojas e crafting ainda não estão implementados; o gerador reserva pontos acessíveis para esses conteúdos futuros. A aba Habilidades mostra os pontos conquistados, mas a árvore de talentos ainda é apenas informativa. As regiões usam a mesma grade-base com caminhos e estruturas próprios por seed; a faixa recomendada altera inimigos, XP e chance de loot, mas ainda não bloqueia acesso por nível. Música e configurações de volume também seguem pendentes.
