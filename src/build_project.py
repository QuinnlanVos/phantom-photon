"""Writes project/game.json for Phantom Photon (GDevelop 5). Usage: python3 build_project.py"""
import json, uuid, copy, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'project')
ref = json.load(open('/workspace/ref/starting-top-down-pixel.json'))
CHAPTERS = json.load(open(os.path.join(HERE, 'chapters.json')))
LEVELS = [lv for ch in CHAPTERS for lv in ch['levels']]
META = json.load(open(os.path.join(HERE, 'art_meta.json')))
T = META['tile']

props = copy.deepcopy(ref['properties'])
props.update(name='Phantom Photon', projectUuid=str(uuid.uuid4()), packageName='com.phantomphoton.game', version='0.2.0',
             scaleMode='linear', pixelsRounding=False, sizeOnStartupMode='adaptWidth', adaptGameResolutionAtRuntime=True,
             antialiasingMode='MSAA', antialisingEnabledOnMobile=True, orientation='default', author='',
             description='Neon puzzle-action: you are a photon that can only move along walls. Swipe to slide, fly until you hit the next wall.',
             windowWidth=720, windowHeight=1280, maxFPS=60, minFPS=20)
props['watermark'] = {'placement': 'bottom', 'showWatermark': True}
props['loadingScreen'].update(backgroundColor=263184, gdevelopLogoStyle='light', minDuration=0.6)

ASSETS = sorted(f for f in os.listdir(f'{OUT}/assets') if f.endswith('.png'))
SIZES = {f: Image.open(f'{OUT}/assets/{f}').size for f in ASSETS}
def res(f): return {"file": f"assets/{f}", "kind": "image", "metadata": "", "name": f, "smoothed": True, "userAdded": True}
FONT = 'Rajdhani-Bold.ttf'
resources = [res(f) for f in ASSETS] + [{"file": f"assets/{FONT}", "kind": "font", "metadata": "", "name": FONT, "userAdded": True}]

def frame(img, center=True):
    w, h = SIZES[img]
    return {"hasCustomCollisionMask": False, "image": img, "points": [],
            "originPoint": {"name": "origine", "x": w / 2 if center else 0, "y": h / 2 if center else 0},
            "centerPoint": {"automatic": True, "name": "centre", "x": 0, "y": 0}, "customCollisionMask": []}
def sprite(name, anims, center=True):
    """anims: list of (animName, [images], timeBetweenFrames)"""
    return {"adaptCollisionMaskAutomatically": False, "assetStoreId": "", "name": name, "type": "Sprite",
            "updateIfNotVisible": True, "variables": [], "effects": [], "behaviors": [],
            "animations": [{"name": an, "useMultipleDirections": False,
                            "directions": [{"looping": True, "timeBetweenFrames": t, "sprites": [frame(i, center) for i in imgs]}]}
                           for (an, imgs, t) in anims]}
def one(name, img, center=True): return sprite(name, [("Idle", [img], 1)], center)
def text(name, size, color, glow, align="center"):
    return {"assetStoreId": "", "name": name, "type": "TextObject::Text", "variables": [], "effects": [], "behaviors": [],
            "content": {"text": "", "font": FONT, "textAlignment": align, "verticalTextAlignment": "top",
                        "characterSize": size, "lineHeight": 0, "color": color, "smoothed": True, "bold": False, "italic": False,
                        "underlined": False, "isOutlineEnabled": False, "outlineThickness": 2, "outlineColor": "0;0;0",
                        "isShadowEnabled": True, "shadowColor": glow, "shadowOpacity": 230, "shadowAngle": 90,
                        "shadowDistance": 0, "shadowBlurRadius": 10}}

objects = [
    {"assetStoreId": "", "height": 192, "width": 192, "name": "BgTile", "texture": "bg_tile.png",
     "type": "TiledSpriteObject::TiledSprite", "variables": [], "effects": [], "behaviors": []},
    one("Nebula", "nebula.png"), one("Mote", "mote.png"),
    sprite("LevelArt", [(f"L{n + 1}", [f"level_{n + 1}.png"], 1) for n in range(len(LEVELS))]),
    one("PadGlow", "pad_glow.png"), one("PadChevron", "pad_chevron.png"),
    one("PortalCore", "portal_core.png"), one("PortalRing", "portal_ring.png"), one("PortalRing2", "portal_ring2.png"),
    one("Shard", "shard.png"), one("ShardIcon", "shard.png"),
    one("BhRange", "bh_range.png"), one("BhSwirl", "bh_swirl.png"), one("BhGlow", "bh_glow.png"), one("BhDisk", "bh_disk.png"), one("BhCore", "bh_core.png"),
    one("Trail", "trail.png"), one("Spark", "spark.png"), one("Ring", "ring.png"),
    one("OrbHalo", "orb_halo.png"), one("Orb", "orb.png"), one("PreviewOrb", "orb.png"),
    one("TitlePhantom", "title_phantom.png", False), one("TitlePhoton", "title_photon.png", False), one("TxtClear", "txt_clear.png", False),
    one("BtnRestart", "btn_restart.png"), one("Flash", "flash.png", False),
    text("LevelText", 26, "200;245;255", "40;200;255"), text("ShardText", 24, "255;225;140", "255;180;60", "left"),
    text("HintText", 22, "170;200;235", "40;120;255"), text("StartText", 30, "220;250;255", "40;220;255"),
    text("ToastText", 30, "255;140;220", "255;60;200"),
    # --- menu / level select / HUD
    one("BtnPill", "btn_pill.png"), one("BtnPillS", "btn_pill_s.png"), one("BtnGlow", "btn_glow.png"), one("BtnGlowS", "btn_glow_s.png"),
    one("BtnRound", "btn_round.png"), one("BtnRoundGlow", "btn_round_glow.png"),
    one("IcBack", "ic_back.png"), one("IcLeft", "ic_left.png"), one("IcRight", "ic_right.png"), one("IcLock", "ic_lock.png"),
    one("IcCheck", "ic_check.png"), one("IcRestart", "ic_restart.png"), one("IcPlay", "ic_play.png"),
    one("NodeFill", "node_fill.png"), one("Soft", "soft.png"), one("SparkW", "spark_w.png"), one("RingW", "ring_w.png"), one("TrailW", "trail_w.png"),
    {"assetStoreId": "", "name": "Card", "type": "PanelSpriteObject::PanelSprite", "variables": [], "effects": [], "behaviors": [],
     "texture": "card_frame.png", "width": 400, "height": 400, "leftMargin": 44, "rightMargin": 44, "topMargin": 44, "bottomMargin": 44, "tiled": False},
    text("BtnText", 46, "255;255;255", "60;210;255"), text("BtnTextS", 30, "255;255;255", "60;210;255"),
    text("HeadText", 34, "210;245;255", "40;200;255"), text("SubText", 22, "175;205;240", "40;120;255"),
    text("ChapterText", 56, "235;250;255", "60;190;255"), text("NodeText", 15, "190;215;245", "40;120;255"),
    # --- the Abyss
    one("Sky", "sky_sun.png", False), one("SunGlow", "sun_glow.png"), one("DustStar", "dust_star.png"), one("DustSoft", "dust_soft.png"),
    one("WindStreak", "wind_streak.png"), one("WindChev", "wind_chev.png"), one("WindZone", "wind_zone.png"),
    one("WellCore", "well_core.png"), one("WellRange", "well_range.png"), one("ExitArrow", "exit_arrow.png"), one("Vignette", "vignette.png", False), one("HudFade", "hud_fade.png", False),
    one("StarCore", "star_core.png"), one("StarCorona", "star_corona.png"), one("StarGlow", "star_glow.png"),
    sprite("Mover", [(f"M{k}", [f"mover_{k}.png"], 1) for k in sorted(META['movers'])]), one("TrackDot", "track_dot.png"),
    sprite("Cloud", [(f"C{k}", [f"cloud_{k}.png"], 1) for k in sorted(META['clouds'], key=int)]), one("CloudPuff", "cloud_puff.png"), one("CloudMask", "cloud_mask.png"),
    dict(one("CloudBlock", "flash.png", False), behaviors=[{"name": "LightObstacle", "type": "Lighting::LightObstacleBehavior"}]),
    # --- Rocks from Space (chapter 4)
    one("VoidSky", "sky_void.png", False), one("PinStar", "pin_star.png"),
    sprite("Asteroid", [(f"A{k + 1}", [f"asteroid_{k + 1}.png"], 1) for k in range(META['rockVariants'])]), one("RockGlow", "rock_glow.png"), one("RockBit", "rock_bit.png"),
    sprite("DustRing", [(f"R{k}", [f"dustring_{k}.png"], 1) for k in sorted(META['rings'], key=int)]),
    one("HailStreak", "hail_streak.png"), one("HailTele", "hail_tele.png"), one("IceBurst", "ice_burst.png"),
    {"assetStoreId": "", "name": "Light", "type": "Lighting::LightObject", "variables": [], "effects": [], "behaviors": [],
     "content": {"radius": 100, "color": "255;255;255", "debugMode": False, "texture": ""}},
]

def inst(name, x, y, z, layer="", angle=0, w=0, h=0):
    return {"angle": angle, "customSize": bool(w), "height": h, "keepRatio": True, "layer": layer, "name": name,
            "persistentUuid": str(uuid.uuid4()), "width": w, "x": x, "y": y, "zOrder": z,
            "numberProperties": [], "stringProperties": [], "initialVariables": []}
# Editor preview of level 1 (the game deletes these and builds levels from src/levels.json at runtime)
L1 = LEVELS[0]['map']; cc = lambda i: i * T + T / 2
aw, ah = META['levelArtSize'][0]
pre = [inst("LevelArt", (len(L1[0]) * T) / 2, (len(L1) * T) / 2, 1)]
for j, row in enumerate(L1):
    for i, ch in enumerate(row):
        if ch == 'E': pre += [inst("PortalCore", cc(i), cc(j), 5), inst("PortalRing", cc(i), cc(j), 6)]
        if ch == '*': pre.append(inst("Shard", cc(i), cc(j), 8))
        if ch == 'S': pre.append(inst("PreviewOrb", cc(i), cc(j), 30))
for p in pre:   # 2x art shown at half size in the editor too
    if p["name"] in ("LevelArt", "PortalCore", "PortalRing", "Shard", "PreviewOrb"):
        w, h = SIZES[{"LevelArt": "level_1.png", "PortalCore": "portal_core.png", "PortalRing": "portal_ring.png", "Shard": "shard.png", "PreviewOrb": "orb.png"}[p["name"]]]
        p.update(customSize=True, width=w / 2, height=h / 2)
        # origin is the image centre; GDevelop instance x/y is the origin position, so keep x/y as the centre

def I(v, params, inv=False):
    t = {"value": v}
    if inv: t["inverted"] = True
    return {"type": t, "parameters": params}
def comment(t):
    return {"type": "BuiltinCommonInstructions::Comment", "color": {"b": 255, "g": 230, "r": 120, "textB": 0, "textG": 0, "textR": 0}, "comment": t}
def group(name, evs, r=40, g=200, b=255):
    return {"colorB": b, "colorG": g, "colorR": r, "creationTime": 0, "name": name, "source": "",
            "type": "BuiltinCommonInstructions::Group", "events": evs, "parameters": []}
def jscode(code):
    return {"type": "BuiltinCommonInstructions::JsCode", "inlineCode": code, "parameterObjects": "", "useStrict": True, "eventsSheetExpanded": False}

SIMSRC = open(os.path.join(HERE, 'sim.js')).read()
LIBSRC = open(os.path.join(HERE, 'lib.js')).read().replace('%CHAPTERS%', json.dumps(CHAPTERS)).replace('%ART%', json.dumps(META))
def scene_code(fn):
    return ("// Movement simulation (src/sim.js) - shared with the Node level solver.\n"
            "const PPSim = gdjs.__PPSim || (gdjs.__PPSim = (function () {\n" + SIMSRC + "\n})());\n"
            "// Shared library (src/lib.js): chapters, progress, buttons, particles, transitions.\n"
            "const LIB = gdjs.__PPLib || (gdjs.__PPLib = (function () {\n" + LIBSRC + "\n})());\n"
            + open(os.path.join(HERE, fn)).read())
CODE = scene_code('game_logic.js')

menu_events = [comment("MAIN MENU - photons fly across, a black hole bends/swallows them, juicy PLAY button -> LevelSelect. Source: src/menu_logic.js"),
               group("Menu (JavaScript)", [jscode(scene_code('menu_logic.js'))])]
select_events = [comment("LEVEL SELECT - chapter cards (swipe / arrows / keys), level nodes, progress from localStorage. ?unlock unlocks everything. Source: src/select_logic.js"),
                 group("Level select (JavaScript)", [jscode(scene_code('select_logic.js'))])]
events = [
    comment("PHANTOM PHOTON - you are a photon of light that can only move along walls.\n"
            "Rules: swipe / arrow keys along a wall you touch -> you slide, fly straight off the end and stick to the next wall you hit. "
            "Ramps (violet) mirror your flight 90 degrees. Pink launch pads: TAP / Space kicks you straight away from them. "
            "Black holes bend your flight and swallow you if you get too close (respawn at your last wall)."),
    group("Game (JavaScript): input, movement sim, levels, effects, camera, UI", [
        comment("Source files: src/sim.js (movement rules, shared with src/solve.js) + src/game_logic.js. Levels: src/levels.json. "
                "Regenerate with src/rebuild.sh. Tuning constants are at the top of sim.js (speed, gravity, swallow radius)."),
        jscode(CODE)]),
]

def layer(name, effects=()):
    l = copy.deepcopy(ref['layouts'][0]['layers'][0]); l['name'] = name; l['effects'] = list(effects)
    l['cameras'] = [{"defaultSize": True, "defaultViewport": True, "height": 0, "viewportBottom": 1, "viewportLeft": 0, "viewportRight": 1, "viewportTop": 0, "width": 0}]
    return l
def eff(kind, name, d): return {"effectType": kind, "name": name, "doubleParameters": d, "stringParameters": {}, "booleanParameters": {}}
def lighting_layer(name, amb=(5, 6, 12)):
    l = layer(name); l.update(isLightingLayer=True, followBaseLayerCamera=True, ambientLightColorR=amb[0], ambientLightColorG=amb[1], ambientLightColorB=amb[2])
    return l
def base_layers(): return [
    layer("Bg", [eff("BulgePinch", "Lens", {"centerX": 0.5, "centerY": 0.5, "radius": 150, "strength": -0.5})]),
    layer("", [eff("AdvancedBloom", "Bloom", {"threshold": 0.32, "bloomScale": 1.15, "brightness": 1.0, "blur": 5, "quality": 5, "padding": 0})])]
UI_LAYER = lambda: layer("UI", [eff("AdvancedBloom", "UiBloom", {"threshold": 0.45, "bloomScale": 0.8, "brightness": 1.0, "blur": 4, "quality": 4, "padding": 0})])
def make_layout(name, evs, inst_list, layers):
    lo = copy.deepcopy(ref['layouts'][0])
    lo.update(name=name, mangledName=name, r=4, v=6, b=16, objectsGroups=[], objects=copy.deepcopy(objects), variables=[],
              objectsFolderStructure={"folderName": "__ROOT", "children": [{"objectName": o["name"]} for o in objects]},
              instances=inst_list, events=evs, layers=layers,
              behaviorsSharedData=[{"name": n, "type": t} for n, t in [
                  ("Animation", "AnimatableCapability::AnimatableBehavior"), ("Effect", "EffectCapability::EffectBehavior"),
                  ("Flippable", "FlippableCapability::FlippableBehavior"), ("Opacity", "OpacityCapability::OpacityBehavior"),
                  ("Text", "TextContainerCapability::TextContainerBehavior"), ("Resizable", "ResizableCapability::ResizableBehavior"),
                  ("Scale", "ScalableCapability::ScalableBehavior"), ("LightObstacle", "Lighting::LightObstacleBehavior")]])
    lo['uiSettings'].update(zoomFactor=1, gridWidth=T, gridHeight=T, grid=True)
    lo['uiSettings'].pop('selectedLayer', None)
    return lo
layouts = [make_layout("Menu", menu_events, [], base_layers() + [UI_LAYER()]),
           make_layout("LevelSelect", select_events, [], base_layers() + [UI_LAYER()]),
           make_layout("Game", events, pre, base_layers() + [lighting_layer("Light"), layer("Hint"), UI_LAYER()])]
game = {"firstLayout": "Menu", "gdVersion": ref['gdVersion'], "properties": props, "resources": {"resources": resources},
        "objects": [], "objectsFolderStructure": {"folderName": "__ROOT"}, "objectsGroups": [], "variables": [],
        "layouts": layouts, "externalEvents": [], "eventsFunctionsExtensions": [], "externalLayouts": [], "tests": []}
for k in ref:
    if k not in game: print('note: ref key not set:', k)
json.dump(game, open(f'{OUT}/game.json', 'w'), indent=2)
print('ok', len(ASSETS), 'images')
