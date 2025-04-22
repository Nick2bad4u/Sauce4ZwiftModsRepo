SISU HUD - Minimalist HUD 
=========================

![SISU HUD Logo](https://raw.githubusercontent.com/sauce-mods-sisu/sisu-hud/main/images/sisu-hud-logo.png)


## Installing
------------------
A Sauce for Zwift "Mod" is a directory placed in `~/Documents/SauceMods`.  NOTE: "Documents"
may be called "My Documents" on some platforms.  For first time mod users they should create
an empty **SauceMods** folder first.  Then each Mod will be a sub directory in there such as...
```
Documents
└── SauceMods
    ├── <Put me here>
```

## Usage
------------------
### Basic Features
- Turn the mod on in Sauce Settings.
- The window is draggable by the top config bar to place
- The window is resizable by the bottom right-hand corner green box "resizeHandle"
- Icons can be dragged into the order you want and will be saved
- Right-clicking will make a stat visible that you don't care about
- In the config bar you can "Reset Visibility" to restore all stat fields
- Text scales and your scaling options are saved
- Settings that allow you to set the color of the icons or values

### Demos
- Pilot: https://www.youtube.com/watch?v=o0c5v4ga8A0
 - represents 15 Jan changelog
- Complete Alpha: https://www.youtube.com/watch?v=4JQxXQm4pt4
- Beta: https://www.youtube.com/watch?v=XbdTfcEKf2s

# Changelog 
------------------

## 29 January 2025
------------------
- Opacity Fixes
- Adding alpha to html and getting rid of background:transparent 

## 24 January 2025
------------------
- Beta Release - 0.1.0
- Settings tab with text/icon color
- Settings modal also shows underlying window size and allows for appropriate resize

## 22 January 2025
------------------
Alpha 0.0.2
Fixed scaling bug

## 20 January 2025
------------------
Alpha 0.0.2
Added gradient stat
Made progress with boungding box issue
Added close button to window

## 17 January 2025
------------------
Added icon/stat sort, visibility settings, and restoring

## 15 January 2025
------------------
Alpha is Born: Resizable and fixed stats


## Known Issues
------------------
- Time on Course is weird ¯\_(ツ)_/¯
- All things are in metric because metric is just better (will fix as inclined)
 - p.s. you should be in metric because you get more xp! (20 per km, vs 30 per mile, conversion is 1.62 km per mile)
- Bounding box and disappearing resizeHandle (square box)
 - Progress has been made, press Settings Button and it will reveal the Electron Window bounding box that you are free to resize
- Distance on Pace Partners is also weird. ¯\_(ツ)_/¯


## FAQ
==================================================
### 1. Why call it SISU HUD?
Sisu means 'go' in Finnish but more importantly it's the team I race with, I both wanted to celebrate them and make our opponents have to see our name everywhere!!! https://www.sisu.racing/

### 2. What problem does SISU HUD solve?
I have Zwift on a TV and was in a Team Time Trial (TTT) recently, we had scheduled pulls every 30 seconds.  I found it impossible to concentrate on my w/kg AND see the time remaining in my pull.  I was also a professional poker player in a former life and we had HUDs that displayed opponent's stats which was the main inspiration for SISU HUD, to place all relevant data right on your avatar (or whever you like).  

### 3. Where is ideal placement of the HUD on Zwift?
I look forward to the creative ways the community uses this, I recommend placing in very near to your rider/avatar.  I think it's important to watch your rider as closely as possible during races to pick up cues from your competitors and to maximize the draft.  Having all of your relevant data nearer your focal point solves the problem of split attention.

## Future Features
------------------
- Support for Imperial and/or your Zwift setting (if I can get to it)
- Color gradients corresponding to ranges for some stats like wBal or whatnot
- Maybe way off in the distant future the ability to have multiple windows and pin to riders
- Profiles