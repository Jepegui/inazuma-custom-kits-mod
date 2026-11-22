# Custom Kits – kits and crests for Inazuma Fantasy

**English** · [Português](#português) · [Español](#español)

Custom Kits is a small app that runs in your browser, on your own PC. With it you can make new **kits** and **crests** for *Inazuma Eleven: Victory Road* with the **Inazuma Fantasy** mod. Everything you make is sold in the game's General Store. The game's own kits and crests stay as they are.

- **Kits:** start from any of the game's kits, change its colours, add crests and sponsors, and set the back number's colours. You can see it on the game's own 3D models. The app also makes the kit's icon and the player cards in the game's style.
- **Crests:** start from one of the game's crests and recolour it, or use a picture of your own (for example a PNG of your club's badge). The app can remove a plain background. Your crests get a tab of their own in the crest picker.
- **Languages:** English, Portuguese and Spanish.

## Download and use

1. Go to [**Releases**](../../releases) and download `CustomKits-2.1.2.zip`. It holds the app and the **reference** folder (the game's files the app reads).
2. **Unzip it** where you like, for example in `C:\Games`, but **not inside Program Files** (see below). You get a `Custom Kits` folder with `Custom Kits.bat`, `custom-kits.html` and the `reference` folder (with a `data` folder inside it). The reference folder gives you every kit base, the game's crests, the 3D view and the player cards.
3. Open **Custom Kits.bat** (it opens the app in Microsoft Edge). You can also open `custom-kits.html` in Edge or Chrome yourself.
4. Choose the game's **mods** folder: the one next to `nie.exe`, with VRFW and BetterQoL in it. Then click **Connect the reference folder…** and choose the `reference` folder.
5. Make a kit or a crest, then switch on the **Custom Kits** mod on the launcher's Mods page.

The app does not work from inside the zip: unzip it first. Do **not** unzip it inside the game's `mods` folder: the app and the reference folder are not mods.

> **Program Files:** Edge and Chrome do not let a page open folders inside `Program Files`, `Program Files (x86)`, `Windows` or `AppData`. Keep the app **and the game** outside them. If the game is in Steam's default library (`C:\Program Files (x86)\Steam`), move it in Steam: right-click the game → **Properties** → **Installed Files** → **Move install folder**, to another library (for example `D:\SteamLibrary`).

### More than one mod

At the top of the app, **Mod** shows which mod you are working on. Click **+ New** to make another one with its own name, for example «Liga Portugal Kits» and «Inazuma Alternative Kits». Each one is a folder of its own in `mods` and is switched on or off on its own in the launcher. **Rename** changes the name the launcher shows.

Always close the game before you generate or delete anything. Before you delete a kit or a crest, take it off your teams.

The app only reads the folders you choose and only writes inside its own mods (`mods\CustomKits` and the ones you make with it). Nothing leaves your computer.

After generating, you can delete the app's folder: everything lives in the mods. Keep the mods' folders.

### Requirements

- Windows with Microsoft Edge (it comes with Windows) or Google Chrome. The app uses the browser's File System Access API.
- Inazuma Fantasy installed with VRFW and BetterQoL.
- Do not use online play or cross-save with mods.

## For developers

The app is plain HTML and JavaScript, with no dependencies. The sources are in [`src`](src):

| File | What it does |
|---|---|
| `page.html` | The page and its styles |
| `app.js` | The kit editor, the mod's files (VRFW), the shop entries |
| `emblems.js` | The crest editor |
| `busts.js` | Player cards and kit icons (WebGL renders of the game's meshes) |
| `viewer3d.js` | G4MD/G4MG mesh reader and the 3D preview |
| `codec.js` | BC7 encoder/decoder and the G4TX texture container |
| `i18n.js` | The interface's languages |
| `data/` | The catalogue of bases, the portrait poses and the texture headers |

To build `app/custom-kits.html` from the sources, run:

```
python build.py
```

## Credits

- **Victory Mods**: the skeleton poses used for the player cards and the kit icons (`src/data/poses.json`, from its `pose_avatar.npz`).
- **IECross**: the texture header used for the player cards, and how the game names its card textures.
- **VRFW**, **BetterQoL** (the kits without sponsors) and **Inazuma Fantasy**: the framework and the mods this app writes for.
- The BC7 tables and decode flow follow **bimg** and **texture2ddecoder** (MIT / BSD-2).

*Inazuma Eleven* and everything from the game belong to LEVEL-5. This is a fan project, not affiliated with LEVEL-5.

## License

[GPL-3.0](LICENSE). You can fork, change and share this project. Copies and changed versions must keep the credits and the same license, and their source code must stay open. If you publish your own version, please let me know by opening an issue.

---

## Português

O Custom Kits é uma app que corre no browser, no teu PC, e cria **equipamentos** e **emblemas** novos para o *Inazuma Eleven: Victory Road* com o mod **Inazuma Fantasy**. Ficam à venda na loja geral do jogo; os do jogo ficam como estão. A app está em inglês, português e espanhol.

Para usar:
1. Em [**Releases**](../../releases), descarrega o `CustomKits-2.1.2.zip`. Tem a app e a pasta **reference** (os ficheiros do jogo que a app lê).
2. **Descomprime-o** onde quiseres, por exemplo em `C:\Games`, mas **não dentro de Program Files**. Fica uma pasta `Custom Kits` com o `Custom Kits.bat`, o `custom-kits.html` e a pasta `reference` (com uma pasta `data` lá dentro). A pasta reference dá-te todas as bases, os emblemas do jogo, o 3D e os cartões dos jogadores.
3. Abre o **Custom Kits.bat**, escolhe a pasta **mods** do jogo e depois carrega em **Ligar a pasta reference…** e escolhe a pasta `reference`.
4. No fim, liga o mod **Custom Kits** no launcher. Fecha sempre o jogo antes de gerar ou apagar alguma coisa.

A app não funciona de dentro do zip: descomprime-o primeiro. **Não** o descomprimas dentro da pasta `mods` do jogo: a app e a pasta reference não são mods.

> **Program Files:** o Edge e o Chrome não deixam uma página abrir pastas dentro de `Program Files`, `Program Files (x86)`, `Windows` ou `AppData`. Mantém a app **e o jogo** fora delas. Se o jogo estiver na biblioteca padrão do Steam (`C:\Program Files (x86)\Steam`), muda-o no Steam: botão direito no jogo → **Propriedades** → **Ficheiros instalados** → **Mover pasta de instalação**, para outra biblioteca (por exemplo `D:\SteamLibrary`).

Podes ter vários mods: em cima, em **Mod**, carrega em **+ Novo** para criar outro com nome próprio (por exemplo «Liga Portugal Kits»). Cada um é uma pasta própria em `mods` e liga-se à parte no launcher.

## Español

Custom Kits es una aplicación que funciona en el navegador, en tu PC, y crea **equipaciones** y **escudos** nuevos para *Inazuma Eleven: Victory Road* con el mod **Inazuma Fantasy**. Se venden en la tienda general del juego; los del juego no cambian. La aplicación está en inglés, portugués y español.

Para usarla:
1. En [**Releases**](../../releases), descarga `CustomKits-2.1.2.zip`. Tiene la aplicación y la carpeta **reference** (los archivos del juego que la aplicación lee).
2. **Descomprímelo** donde quieras, por ejemplo en `C:\Games`, pero **no dentro de Program Files**. Queda una carpeta `Custom Kits` con `Custom Kits.bat`, `custom-kits.html` y la carpeta `reference` (con una carpeta `data` dentro). La carpeta reference te da todas las bases, los escudos del juego, la vista 3D y las tarjetas de los jugadores.
3. Abre **Custom Kits.bat**, elige la carpeta **mods** del juego y después pulsa **Conectar la carpeta reference…** y elige la carpeta `reference`.
4. Al final, activa el mod **Custom Kits** en el launcher. Cierra siempre el juego antes de generar o borrar algo.

La aplicación no funciona desde dentro del zip: descomprímelo primero. **No** lo descomprimas dentro de la carpeta `mods` del juego: la aplicación y la carpeta reference no son mods.

> **Program Files:** Edge y Chrome no dejan que una página abra carpetas dentro de `Program Files`, `Program Files (x86)`, `Windows` o `AppData`. Mantén la aplicación **y el juego** fuera de ellas. Si el juego está en la biblioteca predeterminada de Steam (`C:\Program Files (x86)\Steam`), muévelo en Steam: clic derecho en el juego → **Propiedades** → **Archivos instalados** → **Mover carpeta de instalación**, a otra biblioteca (por ejemplo `D:\SteamLibrary`).

Puedes tener varios mods: arriba, en **Mod**, pulsa **+ Nuevo** para crear otro con su propio nombre (por ejemplo «Liga Portugal Kits»). Cada uno es una carpeta propia en `mods` y se activa por separado en el launcher.
