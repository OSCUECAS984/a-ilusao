# Especificação v2 — imersão, narrativa e áudio

> Pedido enviado em 10/11/2026. Texto preservado como foi escrito.

Aja como um desenvolvedor especialista em jogos HTML5 Canvas 2D. Preciso atualizar e expandir o código atual do nosso jogo da Alegoria da Caverna ("A Ilusão (O Interior da Caverna)") com novas mecânicas de imersão, narrativa e áudio.

Implemente as seguintes melhorias mantendo a estrutura de arquivo único (HTML/CSS/JS puro):

---

### 1. 🎬 TELA DE INÍCIO ANIMADA
* **Reformulação Visual:** Redesenhe a tela de início com elementos dinâmicos em pixel art. Adicione uma animação suave de fundo (como sombras oscilando na parede da caverna ou partículas de poeira/fagulhas flutuando).
* **Tutorial Limpo:** Organize o painel de controles e o resumo das mecânicas de forma muito mais clara e intuitiva para os visitantes da feira lerem rapidamente.

---

### 2. 💬 CAIXAS DE TEXTO, ANIMAÇÕES E RETRATOS (AVATARES)
* **Sistema de Diálogo Estilizado:** Crie caixas de texto com animação suave de aparecimento (efeito de transição/fade e digitação tipo *typewriter*).
* **Miniatura do Personagem:** Ao lado esquerdo de cada caixa de texto, exiba uma mini pixel-art (retrato/avatar) da pessoa que está falando (o protagonista "Code", os prisioneiros ou avisos do sistema), mudando a expressão de acordo com a situação.
* **Explicação de Mecânicas:** Melhore o feedback visual e textuais em tempo real para explicar claramente o que o jogador deve fazer em cada fase.

---

### 3. 👥 DIÁLOGOS COM OS OUTROS PRISIONEIROS (Cenário 1)
* **Interação com NPCs:** No Cenário 1, antes de quebrar as correntes, o jogador pode interagir (pressionando a tecla de interação) com os outros dois prisioneiros acorrentados ao seu lado:
  - **Prisioneiro 1 (O Maluco / Místico):** Vê as sombras como deuses vivos, mensagens cósmicas e entidades sagradas, reagindo de forma delirante e mística.
  - **Prisioneiro 2 (O Arrogante / Cético):** Extremamente convencido de que as sombras são a única verdade absoluta do universo, tratando o "Code" com soberba e chamando-o de louco por questionar a parede.

---

### 4. 🔍 INSPEÇÃO DE OBJETOS E A ARMADILHA DA FOGUEIRA
* **Pontos de Inspeção:** Permita que o jogador examine elementos espalhados pelos cenários (estátuas, árvores, animais no exterior, etc.) exibindo mini diálogos reflexivos na caixa de texto.
* **A Fogueira e o Perigo:** Ao se aproximar e examinar a fogueira (Cenário 2), o jogo exibe um prompt de escolha interativo: *"Deseja tocar na fogueira?"* (`[S/N]`).
  - Se o jogador escolher tocar, o personagem sofre queimadura (feedback visual de dano e texto de dor/surpresa), ensinando na prática que a luz/calor real queima e é diferente das sombras frias.

---

### 5. 🎵 TRILHA SONORA AMBIENTE E EFEITOS (Web Audio API)
* **Áudio Procedural / Offline:** Utilize a `Web Audio API` do navegador para gerar trilhas sonoras ambientes contínuas e suaves (sem necessidade de arquivos de áudio externos `.mp3` que possam falhar offline):
  - **Dentro da Caverna (Cenários 1 a 3):** Trilha sonora misteriosa, baixa e tensa (tons graves e oscilantes de eco de caverna).
  - **Fora da Caverna (Cenários 4 e 5):** Transição automática para uma trilha sonora ambiente de **natureza** (sons suaves de vento, pássaros sintetizados e água corrente pacífica).
* **Efeitos Sonoros (SFX):** Melhore os efeitos sonoros para cliques de menu, quebra de correntes, saltos, passos e o som de dano ao tocar na fogueira.

### 6. Atualize todas as texturas agora usando como base as imagens que te enviei. Na ultima imagem nao implemente o personagem de jesus.
Faça os mapas tão bonitos e trabalhados quanto nas imagens apresentadas e que os mapas tenham um tamanho consideravel. Na parte do exterior enriqueça a ambientação do mundo com animais, rios animados, folhas animadas, sol replasdecente, nuvens se movendo e o que achar melhor.

---

Garanta que a performance permaneça fluida a 60 FPS, mantendo o código limpo, comentado e sem bugs de física ou escala de sprites.
