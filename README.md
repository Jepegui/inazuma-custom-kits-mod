# Custom Kits – kits and crests for Inazuma Fantasy

**English** · [Português](#português) · [Español](#español)

Custom Kits is a small app that runs in your browser, on your own PC. With it you can make new **kits** and **crests** for *Inazuma Eleven: Victory Road* with the **Inazuma Fantasy** mod. Everything you make is sold in the game's General Store. The game's own kits and crests stay as they are.

- **Kits:** start from any of the game's kits, change its colours, add crests and sponsors, and set the back number's colours. You can see it on the game's own 3D models. The app also makes the kit's icon and the player cards in the game's style.
- **Crests:** start from one of the game's crests and recolour it, or use a picture of your own (for example a PNG of your club's badge). The app can remove a plain background. Your crests get a tab of their own in the crest picker.
- **Languages:** English, Portuguese and Spanish.

## Download and use

1. Download the latest release, or the [`app`](app) folder: `Custom Kits.bat` and `custom-kits.html`.
2. Open **Custom Kits.bat** (it opens the app in Microsoft Edge). You can also open `custom-kits.html` in Edge or Chrome yourself.
3. Choose the game's **mods** folder: the one next to `nie.exe`, with VRFW and BetterQoL in it.
4. Optional, but recommended: connect the **reference** folder, which holds the game's files (`data\dx11` and `data\common`). It gives you every kit base, the game's crests, the 3D view and the player cards. Without it you get the kits without sponsors and crests made from your own pictures.
5. Make a kit or a crest, then switch on the **Custom Kits** mod on the launcher's Mods page.

Always close the game before you generate or delete anything. Before you delete a kit or a crest, take it off your teams.

The app only reads the folders you choose and only writes inside `mods\CustomKits`. Nothing leaves your computer.

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

Para usar: descarrega a pasta [`app`](app) (ou a última release), abre o **Custom Kits.bat** e escolhe a pasta **mods** do jogo. Se ligares também a pasta **reference** (os ficheiros do jogo), tens todas as bases, os emblemas do jogo, o 3D e os cartões dos jogadores. No fim, liga o mod **Custom Kits** no launcher. Fecha sempre o jogo antes de gerar ou apagar alguma coisa.

## Español

Custom Kits es una aplicación que funciona en el navegador, en tu PC, y crea **equipaciones** y **escudos** nuevos para *Inazuma Eleven: Victory Road* con el mod **Inazuma Fantasy**. Se venden en la tienda general del juego; los del juego no cambian. La aplicación está en inglés, portugués y español.

Para usarla: descarga la carpeta [`app`](app) (o la última release), abre **Custom Kits.bat** y elige la carpeta **mods** del juego. Si conectas también la carpeta **reference** (los archivos del juego), tienes todas las bases, los escudos del juego, la vista 3D y las tarjetas de los jugadores. Al final, activa el mod **Custom Kits** en el launcher. Cierra siempre el juego antes de generar o borrar algo.
