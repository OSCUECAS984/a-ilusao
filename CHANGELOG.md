# Histórico de versões

## v3.1.1 · 11/11/2026

- **Correção:** ao voltar da subida (Cenário III) para o salão das estátuas, Code e a pedra apareciam no alto da tela. A câmera vertical da subida não era zerada na volta; agora é, e Code aparece no chão, ao lado da passagem.
- Avisos da fase anterior não continuam na tela ao trocar de fase.

## v3.1.0 · 11/11/2026

- **Estátuas (Cenário II):** a interação que era só do cavalo agora vale para todas as estátuas ao mesmo tempo. Um único ponto "As estátuas", no meio da passarela, e durante a fala todas brilham juntas enquanto Code percebe que as sombras do muro eram cópias delas.
- **Entrada da caverna (Cenário IV):** Code volta a pular enquanto está de olhos abertos. Quando a luz fica forte demais e ele fecha os olhos, o jogador perde o controle e Code caminha sozinho, devagar e sem pular, até a saída.
- **Voltar entre as fases:** encostado na borda esquerda, segure ← para voltar. Do Cenário IV volta-se ao alto da subida (Cenário III) e da base da subida volta-se ao salão das estátuas (Cenário II), já de pé e com tudo descoberto. Do Mundo Exterior não há volta.

## v3.0.1 · 11/11/2026

Correções.

- **Saída da caverna (Cenário IV):** o sol, a luz nas montanhas e os raios agora estão sincronizados. O sol fica preso ao ponto das montanhas para onde a luz aponta, as encostas iluminadas ficam viradas para ele e os feixes que entram na caverna saem do próprio sol. Antes, as faces claras das montanhas apontavam para o meio da tela, longe do sol.
- **Apoio na parede (Cenário II):** andar segurando E agora enche a Firmeza (antes quase não enchia) e o Apoio dura cerca de 6 s andando, mais tempo parado. Segurar E antes de começar a andar, ou desde a queda, já agarra a parede (antes era preciso soltar e apertar de novo). Quando o braço cansa, é preciso soltar E para agarrar outra vez.
- Texto do tutorial do Cenário II ajustado à regra nova.

## v3.0.0 · 11/11/2026

Nova build enviada pela equipe, focada em arte.

- **Rochas facetadas:** toda a pedra do jogo virou blocos angulosos (células de Voronoi) com contorno, aresta iluminada e fendas, no lugar das pedras redondas.
- **Code redesenhado** a partir de uma folha de referência: cabeça grande, cabelo castanho espetado, túnica bege de manga comprida, faixa na cintura, calça e botas. Caminhada em 6 quadros, escalada por cipós e animação de desmaio.
- **Retratos** refeitos no mesmo traço dos sprites, incluindo barba e bigode nos prisioneiros.
- **Salão das estátuas** reescavado: nichos atrás de cada estátua, pórtico em ruínas, passarela em patamares, escada até a fogueira, fenda no teto com musgo e cipós, cogumelos luminosos e rocha que muda de cor com a distância do fogo.
- **Estátuas** talhadas em polígonos; sombras projetadas com penumbra pontilhada.
- **Nuvens** em pixel art com base reta e luz do poente.
- Tela inicial com a linha de controles resumida.

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
