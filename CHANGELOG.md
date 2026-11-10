# Histórico de versões

## v2.0.0 · 10/11/2026

Imersão, narrativa e áudio. Especificação em [docs/especificacao-v2.md](docs/especificacao-v2.md).

- **Arte:** resolução interna de 320×180 para 384×216. Code redesenhado maior e mais detalhado (cabelo cacheado, túnica, cinto, sandálias), com a mesma escala em todas as poses.
- **Mapas maiores**, baseados nas imagens de referência:
  - Câmara das sombras e salão das estátuas com colunas, parapeito, braseiro em degraus e fresta de luz no teto.
  - Parkour com cerca de 3 telas de largura, uma plataforma horizontal e uma vertical, tochas, correntes penduradas e dois feixes de luz.
  - Boca da caverna mais longa, com flor na fenda e raios de luz.
  - Exterior com cerca de 4 telas em paralaxe: árvore grande com folhas caindo, sol com raios girando, nuvens rosadas em movimento, montanhas, ciprestes, vila com colunas, cachoeira e rio animados, riacho que cai pela rocha, cervo, coelhos, pássaros, borboletas, libélula, ovelhas e peixes saltando.
- **Tela inicial animada:** câmera lenta sobre as sombras do muro, poeira e fagulhas; painel "Como jogar" e faixa "A jornada".
- **Diálogos com retrato:** caixa com transição, digitação letra a letra e bipes de voz por personagem. Retratos em pixel art de Code (9 expressões), do Místico, do Arrogante, das dicas e do narrador.
- **Objetivo no HUD** que muda a cada etapa.
- **Prisioneiros no Cenário I:** seleção com ← → e E. O Místico vê deuses nas sombras; o Arrogante defende o muro como única verdade. Os dois reagem à pedra e à libertação.
- **Pontos de inspeção** com o ícone ? em todos os cenários.
- **Fogueira:** escolha "Deseja tocar na fogueira? S/N". Tocar causa queimadura com clarão, fumaça e recuo.
- **Áudio sintetizado:** trilha da caverna (zumbido, eco, gotas, notas soltas) que transita para a da natureza (vento, água, pássaros, notas suaves). Efeitos novos para clique, correntes, pulo, passos na pedra e na grama, respingo e queimadura.

## v1.0.0 · 10/11/2026

Reescrita completa. Especificação em [docs/especificacao-v1.md](docs/especificacao-v1.md).

- Cinco cenários com máquina de estados e loop: Correntes (pedra e QTE de 3 golpes), Primeiros Passos (apoio na parede), Parkour, Ofuscamento e Mundo Exterior com queda no precipício.
- Correção do bug de escala do personagem ao se levantar.
- Física de plataforma refeita: sem atravessar plataformas e sem grudar nas paredes.
- Tela inicial com controles, efeitos sonoros simples, contador de ciclos e botões de toque.

> O arquivo da v1 não foi guardado separadamente: a v2 o substituiu durante o desenvolvimento. Esta entrada documenta o que ela continha.
