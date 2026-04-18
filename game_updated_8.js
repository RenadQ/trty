import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
// M3.3: Tab navigator — wrapped in try-catch in case package unavailable in Snack
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Modal,
  Dimensions, StatusBar, Vibration, ScrollView,
  SafeAreaView, Platform, Alert, Easing, Image, useWindowDimensions,
} from 'react-native';

const SvgPkg = (() => { try { return require('react-native-svg'); } catch { return null; } })();
const Svg = SvgPkg?.default || SvgPkg?.Svg || (({ children }) => children ?? null);
const Path = SvgPkg?.Path || (() => null);
const Circle = SvgPkg?.Circle || (() => null);
const Ellipse = SvgPkg?.Ellipse || (() => null);
const Rect = SvgPkg?.Rect || (() => null);
const G = SvgPkg?.G || (({ children }) => children ?? null);
const Defs = SvgPkg?.Defs || (({ children }) => children ?? null);
const Mask = SvgPkg?.Mask || (({ children }) => children ?? null);
const RadialGradient = SvgPkg?.RadialGradient || (() => null);
const Stop = SvgPkg?.Stop || (() => null);
const Line = SvgPkg?.Line || (() => null);

const ExpoAV = (() => { try { return require('expo-av'); } catch { return null; } })();
const Audio = ExpoAV?.Audio ?? null;
const Video = ExpoAV?.Video ?? null;
const ResizeMode = ExpoAV?.ResizeMode ?? null;
const ScreenOrientation = (() => { try { return require('expo-screen-orientation'); } catch { return null; } })();


const AsyncStorage = (() => { try { return require('@react-native-async-storage/async-storage').default; } catch { return null; } })();
const _memStore = {};
const storage = {
  async get(key){
    try{
      if(AsyncStorage){const v=await AsyncStorage.getItem(key);return v;}
      return _memStore[key] ?? null;
    }catch{return null;}
  },
  async set(key,val){
    try{
      if(AsyncStorage){await AsyncStorage.setItem(key,val);return;}
      _memStore[key]=val;
    }catch(e){/* ignore */}
  },
};
const PROFILE_KEY='LASTFLOOR_PROFILE_V1';
// Character appearance payload
const CHAR_KEY='LASTFLOOR_CHAR_V1';
const STATS_KEY='LASTFLOOR_STATS_V1';
const COINS_KEY='LASTFLOOR_COINS_V1';
// M4.1 & M4.2: Additional storage keys and constants
const LOCATION_KEY='LASTFLOOR_LOCATION_V1';
const LASTRESULT_KEY='LASTFLOOR_LASTRESULT_V1';
const ALL_STORAGE_KEYS = [PROFILE_KEY, CHAR_KEY, STATS_KEY, COINS_KEY, LOCATION_KEY, LASTRESULT_KEY];
const CONTINUE_COST_BASE = 15; // M4.2: first continue costs 15 coins, doubles each time

// M4.1: GameContext — global state for coins + profile accessible anywhere
const GameContext = React.createContext({ totalCoins: 0, profile: { name: '' } });
const useGameContext = () => React.useContext(GameContext);

function HubTabs({ onStartGame, profile, setProfile, openSettings, openAchievements, charData, onEditCharacter }) {
  const [tab, setTab] = useState('home');
  const { width: W, height: H } = useWindowDimensions();
  const LW = Math.max(W, H);
  const LH = Math.min(W, H);
  // iPhone safe areas
  const SAFE_L   = Platform.OS === 'ios' ? 44 : 0;
  const SAFE_R   = Platform.OS === 'ios' ? 44 : 0;
  const SAFE_BOT = Platform.OS === 'ios' ? 20 : 4;

  // ── Global flicker + spider web animations ──
  const globalFlicker = useRef(new Animated.Value(1)).current;
  const webPulse      = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    // Realistic multi-stage light flicker
    const doFlicker = () => {
      const seqItems = [];
      const steps = 3 + Math.floor(Math.random()*4);
      for(let i=0;i<steps;i++){
        seqItems.push(Animated.timing(globalFlicker,{toValue:0.88+Math.random()*0.10,duration:40+Math.random()*120,useNativeDriver:true}));
        seqItems.push(Animated.timing(globalFlicker,{toValue:0.96+Math.random()*0.04,duration:30+Math.random()*80,useNativeDriver:true}));
      }
      seqItems.push(Animated.timing(globalFlicker,{toValue:1,duration:60,useNativeDriver:true}));
      seqItems.push(Animated.delay(2000+Math.random()*5000));
      Animated.sequence(seqItems).start(doFlicker);
    };
    doFlicker();
    // Spider web breathing pulse
    Animated.loop(Animated.sequence([
      Animated.timing(webPulse,{toValue:1,duration:3500,useNativeDriver:true}),
      Animated.timing(webPulse,{toValue:0,duration:3500,useNativeDriver:true}),
    ])).start();
  },[]);

  // Spider web SVG paths (corner webs)
  const SpiderWeb = ({x=0,y=0,size=180,flip=false,flipV=false})=>{
    const sx = flip?-1:1; const sy = flipV?-1:1;
    const rings = [0.28,0.48,0.68,0.88,1.0];
    const spokes = 8;
    const paths=[];
    // Radial spokes
    for(let i=0;i<spokes;i++){
      const angle=(i/spokes)*Math.PI*0.5;
      paths.push(`M0,0 L${Math.cos(angle)*size*sx},${Math.sin(angle)*size*sy}`);
    }
    // Concentric arcs connecting spoke tips
    rings.forEach(r=>{
      let d=`M${Math.cos(0)*size*r*sx},${Math.sin(0)*size*r*sy}`;
      for(let i=1;i<=spokes;i++){
        const angle=(i/spokes)*Math.PI*0.5;
        d+=` L${Math.cos(angle)*size*r*sx},${Math.sin(angle)*size*r*sy}`;
      }
      paths.push(d);
    });
    return(
      <Svg width={size+10} height={size+10} style={{position:'absolute',left:x,top:y}}>
        <G>
          {paths.map((d,i)=>(
            <Path key={i} d={d} stroke="rgba(200,200,255,0.13)" strokeWidth={0.8} fill="none"/>
          ))}
        </G>
      </Svg>
    );
  };

  return (
    <View style={{ width: LW, height: LH, backgroundColor: '#06050e' }}>
      <StatusBar hidden />

      {/* ── Spider web corners (static SVG layer) ── */}
      <View style={{position:'absolute',inset:0}} pointerEvents="none">
        <Animated.View style={{opacity:webPulse.interpolate({inputRange:[0,1],outputRange:[0.55,1]})}}>
          <SpiderWeb x={0} y={0} size={Math.round(LW*0.18)} />
          <SpiderWeb x={LW-Math.round(LW*0.18)-10} y={0} size={Math.round(LW*0.18)} flip />
          <SpiderWeb x={0} y={LH-Math.round(LW*0.18)-10} size={Math.round(LW*0.16)} flipV />
          <SpiderWeb x={LW-Math.round(LW*0.16)-10} y={LH-Math.round(LW*0.16)-10} size={Math.round(LW*0.15)} flip flipV />
        </Animated.View>
      </View>

      {/* Subtle background texture */}
      <View style={{position:'absolute',inset:0}} pointerEvents="none">
        {Array.from({length:8}).map((_,i)=>(
          <View key={`hl${i}`} style={{
            position:'absolute', left:0, right:0,
            top: Math.round((i/7)*LH), height:1,
            backgroundColor:'rgba(255,255,255,0.016)',
          }}/>
        ))}
        <View style={{
          position:'absolute', left:LW*0.3, top:-LH*0.2,
          width:LW*0.5, height:LH*1.3, borderRadius:LH*0.65,
          backgroundColor:'rgba(201,164,76,0.022)',
        }}/>
      </View>

      {/* ── Global flicker overlay — covers ALL tab content realistically ── */}
      <Animated.View style={{position:'absolute',inset:0,backgroundColor:'rgba(0,0,0,0)',opacity:globalFlicker}} pointerEvents="none"/>

      {/* ── Content area ── */}
      <Animated.View style={{ flex:1, paddingLeft:SAFE_L, paddingRight:SAFE_R, opacity:globalFlicker }}>
        {tab === 'home' && (
          <HomeScreen
            profile={profile} charData={charData}
            onPlay={onStartGame} lh={LH} lw={LW}
          />
        )}
        {tab === 'profile' && (
          <ProfileScreen
            profile={profile} setProfile={setProfile}
            charData={charData} onEditCharacter={onEditCharacter}
            onPlay={onStartGame}
            openSettings={openSettings} openAchievements={openAchievements}
            lh={LH} lw={LW}
          />
        )}
        {tab === 'rules' && <RulesScreen />}
      </Animated.View>

      {/* ── Bottom nav: PROFILE | START | RULES only ── */}
      <HubBottomNav
        tab={tab} onTab={setTab} onStart={onStartGame}
        safeL={SAFE_L} safeR={SAFE_R} safeBot={SAFE_BOT} lh={LH}
      />
    </View>
  );
}

function HubBottomNav({ tab, onTab, onStart, safeL=0, safeR=0, safeBot=4, lh=300 }) {
  const BTN_H = Math.round(Math.max(44, Math.min(54, lh * 0.138)));

  const NavItem = ({ id, label }) => {
    const active = tab === id;
    return (
      <TouchableOpacity onPress={() => onTab(id)} activeOpacity={0.8}
        style={{
          flex:1, height:BTN_H, borderRadius:13,
          backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
          alignItems:'center', justifyContent:'center',
        }}>
        <Text style={{
          color: active ? '#e8dcc8' : 'rgba(255,255,255,0.35)',
          fontFamily:'monospace', fontSize:10, letterSpacing:2,
          fontWeight: active ? '900' : '400',
        }}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{
      paddingLeft:safeL+8, paddingRight:safeR+8,
      paddingTop:6, paddingBottom:safeBot,
      flexDirection:'row', alignItems:'center', gap:8,
      backgroundColor:'rgba(4,3,14,0.97)',
      borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.06)',
    }}>
      <NavItem id="profile" label="PROFILE" />

      {/* ── Gold START centrepiece ── */}
      <TouchableOpacity onPress={onStart} activeOpacity={0.88}
        style={{
          flex:2.2, height:BTN_H+4, borderRadius:14,
          backgroundColor:'#c9a44c',
          justifyContent:'center', alignItems:'center',
          shadowColor:'#c9a44c', shadowRadius:16, shadowOpacity:0.45, elevation:12,
        }}>
        <Text style={{
          color:'#07060f', fontFamily:'monospace',
          fontWeight:'900', fontSize:13, letterSpacing:4,
        }}>▶  START</Text>
      </TouchableOpacity>

      <NavItem id="rules" label="RULES" />
    </View>
  );
}

// HomeScreen — clean landing page: title at top-center, avatar + coin, no menu clutter
function HomeScreen({ profile, charData, onPlay, lh=300, lw=600 }) {
  const name = profile?.name?.trim() ? profile.name.trim() : 'Human';
  const [stats, setStats] = useState({ escapes:0, deaths:0, bestEscapeMs:0 });
  const [coins, setCoins] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  // Animated values for horror background
  const flickerAnim = useRef(new Animated.Value(1)).current;
  const bloodDrip1  = useRef(new Animated.Value(-30)).current;
  const bloodDrip2  = useRef(new Animated.Value(-50)).current;
  const bloodDrip3  = useRef(new Animated.Value(-20)).current;
  const fogAnim     = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const tipFade     = useRef(new Animated.Value(1)).current;

  const TIPS = [
    '👻 Stay outside ghost zones — they notice every footstep.',
    '🗝 Memorise the key position during the 15s lit preview.',
    '❄ Save your Freeze charge for when a ghost is chasing you.',
    '💥 PUSH a ghost to earn a bonus coin instantly.',
    '🔇 In Dark Mode — silence is your only weapon.',
    '🛗 Ride the elevator freely, but you need ALL 4 keys to escape.',
    '🛡 Arm your Shield BEFORE entering a danger zone.',
    '⚡ Double-tap a direction to sprint — use it to escape chases.',
    '🪙 Coins carry over across runs. Save them for continues.',
    '👁 BRUTAL floors have fast ghosts — freeze first, run second.',
  ];

  const msToClock = (ms) => {
    if(!ms||ms<=0) return '--';
    const s=Math.floor(ms/1000), m=Math.floor(s/60);
    return `${m}:${(s%60)<10?'0':''}${s%60}`;
  };

  useEffect(()=>{
    let alive = true;
    (async()=>{
      try{
        const rs = await storage.get(STATS_KEY);
        if(rs&&alive){ try{const j=JSON.parse(rs);if(j)setStats(s=>({...s,...j}));}catch(e){} }
        const rc = await storage.get(COINS_KEY);
        if(rc&&alive){ try{setCoins(parseInt(rc,10)||0);}catch(e){} }
      }catch(e){}
    })();
    return ()=>{ alive=false; };
  },[]);

  // Tip rotation with fade
  useEffect(()=>{
    const interval = setInterval(()=>{
      Animated.timing(tipFade,{toValue:0,duration:400,useNativeDriver:true}).start(()=>{
        setTipIdx(i=>(i+1)%TIPS.length);
        Animated.timing(tipFade,{toValue:1,duration:400,useNativeDriver:true}).start();
      });
    }, 4000);
    return ()=>clearInterval(interval);
  },[]);

  // Horror animations
  useEffect(()=>{
    // Flickering light effect
    const flicker = ()=>{
      Animated.sequence([
        Animated.timing(flickerAnim,{toValue:0.92,duration:80,useNativeDriver:true}),
        Animated.timing(flickerAnim,{toValue:1,duration:60,useNativeDriver:true}),
        Animated.timing(flickerAnim,{toValue:0.88,duration:120,useNativeDriver:true}),
        Animated.timing(flickerAnim,{toValue:1,duration:80,useNativeDriver:true}),
        Animated.delay(3000 + Math.random()*4000),
      ]).start(flicker);
    };
    flicker();

    // Blood drip animations
    const drip = (anim, delay, duration)=>{
      const run = ()=>{
        anim.setValue(-60);
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim,{toValue:lh*0.35,duration,useNativeDriver:true,easing:Easing.in(Easing.quad)}),
          Animated.delay(2000),
        ]).start(run);
      };
      run();
    };
    drip(bloodDrip1, 500,  2800);
    drip(bloodDrip2, 1800, 3400);
    drip(bloodDrip3, 3200, 2200);

    // Fog pulse
    Animated.loop(Animated.sequence([
      Animated.timing(fogAnim,{toValue:1,duration:3000,useNativeDriver:true}),
      Animated.timing(fogAnim,{toValue:0,duration:3000,useNativeDriver:true}),
    ])).start();

    // Red corner pulse
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:1,duration:2000,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:0,duration:2000,useNativeDriver:true}),
    ])).start();
  },[lh]);

  const winRate = (stats.escapes+stats.deaths)>0
    ? Math.round((stats.escapes/(stats.escapes+stats.deaths))*100) : 0;
  const rank = stats.escapes>5?'VETERAN':stats.escapes>2?'ESCAPIST':stats.escapes>0?'RUNNER':'NEWCOMER';
  const isSmall = lh < 320;

  // Bigger character: increased from 1.25 to 2.0
  const charSize = isSmall ? 1.6 : 2.2;
  const avatarSize = isSmall ? 88 : 108;

  return (
    <View style={{flex:1, flexDirection:'column', overflow:'hidden'}}>

      {/* ══ HORROR BACKGROUND LAYER ══ */}
      <View style={{position:'absolute',inset:0}} pointerEvents="none">

        {/* Base dark gradient zones */}
        <View style={{position:'absolute',inset:0,backgroundColor:'#03020a'}}/>

        {/* Red corner glows — pulsing */}
        <Animated.View style={{
          position:'absolute', left:-60, top:-60,
          width:200, height:200, borderRadius:100,
          backgroundColor:'rgba(180,0,20,0.12)',
          opacity:pulseAnim,
        }}/>
        <Animated.View style={{
          position:'absolute', right:-60, bottom:-40,
          width:220, height:220, borderRadius:110,
          backgroundColor:'rgba(160,0,30,0.10)',
          opacity:pulseAnim.interpolate({inputRange:[0,1],outputRange:[0.3,1]}),
        }}/>

        {/* Fog/mist layer */}
        <Animated.View style={{
          position:'absolute', left:0, right:0, bottom:0, height:lh*0.5,
          backgroundColor:'rgba(8,4,20,0.55)',
          opacity:fogAnim.interpolate({inputRange:[0,1],outputRange:[0.3,0.65]}),
        }}/>

        {/* Blood drip 1 */}
        <Animated.View style={{
          position:'absolute', left:'18%', top:0, width:3,
          transform:[{translateY:bloodDrip1}],
        }}>
          <View style={{width:4,height:4,borderRadius:2,backgroundColor:'#8b0000',alignSelf:'center'}}/>
          <View style={{width:2,backgroundColor:'#6b0000',height:40,alignSelf:'center',borderRadius:1}}/>
          <View style={{width:8,height:8,borderRadius:4,backgroundColor:'#8b0000',alignSelf:'center'}}/>
        </Animated.View>

        {/* Blood drip 2 */}
        <Animated.View style={{
          position:'absolute', left:'52%', top:0, width:3,
          transform:[{translateY:bloodDrip2}],
        }}>
          <View style={{width:3,height:3,borderRadius:2,backgroundColor:'#7b0000',alignSelf:'center'}}/>
          <View style={{width:2,backgroundColor:'#5b0000',height:55,alignSelf:'center',borderRadius:1}}/>
          <View style={{width:7,height:7,borderRadius:4,backgroundColor:'#7b0000',alignSelf:'center'}}/>
        </Animated.View>

        {/* Blood drip 3 */}
        <Animated.View style={{
          position:'absolute', left:'78%', top:0, width:3,
          transform:[{translateY:bloodDrip3}],
        }}>
          <View style={{width:5,height:5,borderRadius:3,backgroundColor:'#9b0000',alignSelf:'center'}}/>
          <View style={{width:2,backgroundColor:'#6b0000',height:30,alignSelf:'center',borderRadius:1}}/>
          <View style={{width:9,height:9,borderRadius:5,backgroundColor:'#9b0000',alignSelf:'center'}}/>
        </Animated.View>

        {/* Horizontal scan lines for horror vibe */}
        {Array.from({length:6}).map((_,i)=>(
          <View key={i} style={{
            position:'absolute', left:0, right:0,
            top:Math.round((i/5)*lh), height:1,
            backgroundColor:'rgba(255,0,0,0.025)',
          }}/>
        ))}
      </View>

      {/* ══ CONTENT (flickered) ══ */}
      <Animated.View style={{flex:1,flexDirection:'column',opacity:flickerAnim}}>

        {/* TITLE */}
        <View style={{
          paddingTop: isSmall ? 8 : 12,
          paddingBottom: isSmall ? 4 : 8,
          alignItems:'center',
          borderBottomWidth:1,
          borderBottomColor:'rgba(201,164,76,0.15)',
        }}>
          <Text style={{
            color:'#c9a44c', fontFamily:'monospace', fontWeight:'900',
            fontSize: isSmall ? 18 : 22, letterSpacing:5,
            textShadowColor:'rgba(201,164,76,0.60)', textShadowRadius:18,
            textAlign:'center',
          }}>THE LAST FLOOR</Text>
          {/* Team names — WHITE and clearly readable */}
          <Text style={{
            color:'#ffffff', fontFamily:'monospace',
            fontSize:8, letterSpacing:3, marginTop:3,
            textShadowColor:'rgba(255,255,255,0.3)', textShadowRadius:6,
          }}>Zahraa · Waad · Renad</Text>
        </View>

        {/* BODY — 2 column */}
        <View style={{flex:1, flexDirection:'row', paddingHorizontal:10, paddingVertical:6, gap:10}}>

          {/* LEFT: bigger avatar + name + coins */}
          <View style={{
            width: Math.round(lw * 0.30),
            justifyContent:'center', alignItems:'center', gap:6,
            borderRightWidth:1, borderRightColor:'rgba(180,0,0,0.15)',
            paddingRight:10,
          }}>
            {/* Bigger avatar */}
            <View style={{
              width:avatarSize, height:avatarSize,
              borderRadius:avatarSize/2.8,
              backgroundColor:'rgba(0,0,0,0.60)',
              borderWidth:2.5, borderColor:'rgba(201,164,76,0.55)',
              justifyContent:'center', alignItems:'center',
              shadowColor:'#c9a44c', shadowRadius:16, shadowOpacity:0.50,
            }}>
              {charData
                ? <ChibiCharacter charData={charData} size={charSize}/>
                : <Text style={{color:'rgba(255,255,255,0.18)',fontSize:30}}>?</Text>}
            </View>
            <Text style={{
              color:'#e8dcc8', fontFamily:'monospace', fontWeight:'900',
              fontSize:isSmall?12:15, letterSpacing:1, textAlign:'center',
            }} numberOfLines={1}>{name}</Text>
            <View style={{
              paddingHorizontal:8, paddingVertical:3, borderRadius:6,
              backgroundColor:'rgba(200,0,20,0.10)',
              borderWidth:1, borderColor:'rgba(200,0,20,0.25)',
            }}>
              <Text style={{color:'rgba(255,130,130,0.70)',fontFamily:'monospace',fontSize:7,letterSpacing:2}}>
                {rank}
              </Text>
            </View>
            {/* Coin pill */}
            <View style={{
              flexDirection:'row', alignItems:'center', gap:5,
              paddingHorizontal:12, paddingVertical:5, borderRadius:14,
              backgroundColor:'rgba(201,164,76,0.12)',
              borderWidth:1, borderColor:'rgba(201,164,76,0.35)',
            }}>
              <Text style={{fontSize:13}}>🪙</Text>
              <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:isSmall?15:18}}>
                {coins}
              </Text>
            </View>
          </View>

          {/* RIGHT: stats + tip + ghost warning */}
          <View style={{flex:1, justifyContent:'center', gap: isSmall?5:8}}>

            {/* 2×2 stat grid */}
            <View style={{gap:5}}>
              {[
                [{label:'WIN %', val:`${winRate}%`, color:'#5ecfa0', bg:'rgba(94,207,160,0.07)'},
                 {label:'ESCAPES', val:`${stats.escapes}`, color:'#c9a44c', bg:'rgba(201,164,76,0.07)'}],
                [{label:'DEATHS', val:`${stats.deaths}`, color:'#ff6666', bg:'rgba(255,80,80,0.07)'},
                 {label:'BEST', val:msToClock(stats.bestEscapeMs), color:'#88ddff', bg:'rgba(100,180,255,0.07)'}],
              ].map((row,ri)=>(
                <View key={ri} style={{flexDirection:'row',gap:5}}>
                  {row.map(c=>(
                    <View key={c.label} style={{
                      flex:1, borderRadius:10, paddingVertical:isSmall?5:7, paddingHorizontal:5,
                      backgroundColor:c.bg, borderWidth:1, borderColor:c.color+'28',
                      alignItems:'center', gap:2,
                    }}>
                      <Text style={{color:c.color,fontFamily:'monospace',fontWeight:'900',
                        fontSize:isSmall?13:15}}>{c.val}</Text>
                      <Text style={{color:'rgba(255,255,255,0.25)',fontFamily:'monospace',
                        fontSize:6,letterSpacing:1.5}}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Rotating survival tip */}
            <View style={{
              borderRadius:10, paddingVertical:7, paddingHorizontal:10,
              backgroundColor:'rgba(100,0,20,0.15)',
              borderWidth:1, borderColor:'rgba(200,0,40,0.20)',
              minHeight:38, justifyContent:'center',
            }}>
              <Text style={{color:'rgba(255,100,100,0.55)',fontFamily:'monospace',fontSize:6,letterSpacing:3,marginBottom:3}}>
                SURVIVAL TIP
              </Text>
              <Animated.Text style={{
                color:'rgba(255,220,220,0.75)',fontFamily:'monospace',fontSize:isSmall?8:9,
                lineHeight:14, opacity:tipFade,
              }}>
                {TIPS[tipIdx]}
              </Animated.Text>
            </View>

            {/* Ghost warning */}
            <View style={{
              flexDirection:'row', alignItems:'center', gap:8,
              borderRadius:11, paddingVertical:6, paddingHorizontal:10,
              backgroundColor:'rgba(255,20,20,0.07)',
              borderWidth:1, borderColor:'rgba(255,60,60,0.18)',
            }}>
              <Text style={{fontSize:14}}>👻</Text>
              <Text style={{color:'rgba(255,100,100,0.60)',fontFamily:'monospace',
                fontSize:isSmall?7:8,letterSpacing:1,flex:1}}>
                4 floors · real ghosts · no second chances
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function RulesScreen() {
  // Staggered entry animations — each section fades/slides in sequentially
  const anims = useRef(Array.from({length:12}, ()=>new Animated.Value(0))).current;

  useEffect(()=>{
    Animated.stagger(120, anims.map(a=>
      Animated.spring(a,{toValue:1,friction:7,tension:60,useNativeDriver:true})
    )).start();
  },[]);

  const FadeIn = ({idx, children, style})=>(
    <Animated.View style={[style,{
      opacity: anims[idx],
      transform:[{translateY: anims[idx].interpolate({inputRange:[0,1],outputRange:[24,0]})}],
    }]}>
      {children}
    </Animated.View>
  );

  const Section = ({label, emoji, idx})=>(
    <FadeIn idx={idx}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:22,marginBottom:10}}>
        <View style={{flex:1,height:1,backgroundColor:'rgba(200,0,20,0.20)'}}/>
        <Text style={{color:'rgba(201,164,76,0.90)',fontFamily:'monospace',fontSize:10,letterSpacing:3}}>
          {emoji}  {label}  {emoji}
        </Text>
        <View style={{flex:1,height:1,backgroundColor:'rgba(200,0,20,0.20)'}}/>
      </View>
    </FadeIn>
  );

  const Rule = ({sym, symColor='#d6c8ff', title, body, emoji='', idx})=>(
    <FadeIn idx={idx} style={{marginBottom:9}}>
      <View style={{flexDirection:'row',gap:12,paddingVertical:12,paddingHorizontal:13,borderRadius:14,
        backgroundColor:'rgba(15,0,5,0.70)',borderWidth:1,borderColor:'rgba(255,255,255,0.07)'}}>
        <View style={{width:46,height:46,borderRadius:12,backgroundColor:'rgba(180,0,20,0.15)',
          borderWidth:1,borderColor:symColor+'44',alignItems:'center',justifyContent:'center'}}>
          {emoji
            ? <Text style={{fontSize:20}}>{emoji}</Text>
            : <Text style={{color:symColor,fontFamily:'monospace',fontWeight:'900',fontSize:13}}>{sym}</Text>
          }
        </View>
        <View style={{flex:1}}>
          <Text style={{color:symColor,fontFamily:'monospace',fontWeight:'900',fontSize:13,letterSpacing:1,marginBottom:5}}>{title}</Text>
          <Text style={{color:'rgba(255,220,220,0.65)',fontFamily:'monospace',fontSize:11,lineHeight:18}}>{body}</Text>
        </View>
      </View>
    </FadeIn>
  );

  const DIFF_ROWS = [
    {label:'EASY',   emoji:'🟢', color:'#00ff88', bg:'rgba(0,200,100,0.07)',border:'rgba(0,220,120,0.25)',
     maze:'Small', ghosts:'2 Normal', key:'Near', items:'❄ Freeze · 💥 Push×2 · 🩹 Bandage · ⚡ Speed'},
    {label:'MEDIUM', emoji:'🟡', color:'#ffdd00', bg:'rgba(255,200,0,0.07)',border:'rgba(255,200,0,0.25)',
     maze:'Medium',ghosts:'3 Normal', key:'Far',  items:'❄ Freeze · 💥 Push×2 · 🩹 Bandage · 🛡 Shield'},
    {label:'HARD',   emoji:'🟠', color:'#ff8800', bg:'rgba(255,100,0,0.07)',border:'rgba(255,100,0,0.25)',
     maze:'Large', ghosts:'4 Normal', key:'Very Far', items:'❄ Freeze · 💥 Push · 🩹 Bandage · 🛡 Shield · 💀 Kill'},
    {label:'BRUTAL', emoji:'🔴', color:'#ff4444', bg:'rgba(255,0,0,0.09)', border:'rgba(255,0,0,0.30)',
     maze:'Huge',  ghosts:'2N + 2 Fast', key:'Hidden',items:'❄ Freeze · 💥 Push · 🛡 Shield · 💀 Kill Orb'},
    {label:'HAUNTED',emoji:'💜', color:'#cc88ff', bg:'rgba(160,0,255,0.08)',border:'rgba(180,0,255,0.25)',
     maze:'Any',   ghosts:'1 Phase Ghost',key:'Any',  items:'Phase ghost passes through all walls!'},
  ];

  return (
    <ScrollView style={{flex:1,backgroundColor:'#030008'}}
      contentContainerStyle={{paddingBottom:50, paddingHorizontal:14}}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <FadeIn idx={0}>
        <View style={{alignItems:'center',marginBottom:16,paddingTop:10}}>
          <Text style={{color:'rgba(255,255,255,0.18)',fontFamily:'monospace',fontSize:9,letterSpacing:6,marginBottom:6}}>
            THE LAST FLOOR
          </Text>
          <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',letterSpacing:5,fontSize:20,
            textShadowColor:'rgba(201,164,76,0.5)',textShadowRadius:12}}>
            📖  HOW TO SURVIVE
          </Text>
          <View style={{flexDirection:'row',gap:4,marginTop:10}}>
            {['👻','🗝','🛗','💀','🪙'].map((e,i)=>(
              <Text key={i} style={{fontSize:16,opacity:0.6}}>{e}</Text>
            ))}
          </View>
        </View>
      </FadeIn>

      <Section label="OBJECTIVE" emoji="🎯" idx={1}/>
      <FadeIn idx={1}>
        <View style={{padding:15,borderRadius:16,backgroundColor:'rgba(201,164,76,0.07)',
          borderWidth:1,borderColor:'rgba(201,164,76,0.22)',marginBottom:4}}>
          <Text style={{color:'rgba(255,230,200,0.85)',fontFamily:'monospace',fontSize:12,lineHeight:20}}>
            Survive all <Text style={{color:'#c9a44c',fontWeight:'900'}}>4 floors 🏢</Text>.{'\n'}
            Find the <Text style={{color:'#c9a44c',fontWeight:'900'}}>🗝 key</Text> on each floor.{'\n'}
            Collect all 4 → ride to Floor 4 → press <Text style={{color:'#80ffb0',fontWeight:'900'}}>🚪 OPEN THE DOOR</Text> to escape!
          </Text>
        </View>
      </FadeIn>

      <Section label="DIFFICULTY TIERS" emoji="⚠️" idx={2}/>
      <FadeIn idx={2}>
        <View style={{gap:8,marginBottom:4}}>
          {DIFF_ROWS.map((row)=>(
            <View key={row.label} style={{borderRadius:14,borderWidth:1.5,borderColor:row.border,
              backgroundColor:row.bg,overflow:'hidden'}}>
              <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingTop:9,paddingBottom:7,gap:8}}>
                <View style={{width:80,paddingVertical:5,borderRadius:8,alignItems:'center',
                  backgroundColor:'rgba(0,0,0,0.40)',borderWidth:1.5,borderColor:row.border}}>
                  <Text style={{fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:2,color:row.color}}>
                    {row.emoji} {row.label}
                  </Text>
                </View>
                <View style={{flex:1,flexDirection:'row',justifyContent:'space-around'}}>
                  {[['MAZE',row.maze],['GHOSTS',row.ghosts],['KEY',row.key]].map(([lbl,val])=>(
                    <View key={lbl} style={{alignItems:'center',gap:2}}>
                      <Text style={{color:'rgba(255,255,255,0.28)',fontFamily:'monospace',fontSize:7,letterSpacing:1}}>{lbl}</Text>
                      <Text style={{color:'rgba(255,255,255,0.80)',fontFamily:'monospace',fontWeight:'900',fontSize:10}}>{val}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={{borderTopWidth:1,borderTopColor:'rgba(255,255,255,0.06)',
                paddingHorizontal:12,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:6}}>
                <Text style={{color:'rgba(255,255,255,0.25)',fontFamily:'monospace',fontSize:7,letterSpacing:2,width:36}}>ITEMS</Text>
                <Text style={{flex:1,fontFamily:'monospace',fontSize:10,color:row.color,lineHeight:16,flexWrap:'wrap'}}>{row.items}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <Section label="SILENCE WARNING" emoji="🔇" idx={3}/>
      <FadeIn idx={3}>
        <View style={{padding:14,borderRadius:16,backgroundColor:'rgba(255,20,20,0.08)',
          borderWidth:1.5,borderColor:'rgba(255,60,60,0.40)',marginBottom:4}}>
          <Text style={{color:'#ff7777',fontFamily:'monospace',fontWeight:'900',fontSize:12,letterSpacing:2,marginBottom:6}}>
            🎙 GHOSTS CAN HEAR YOU
          </Text>
          <Text style={{color:'rgba(255,190,190,0.78)',fontFamily:'monospace',fontSize:11,lineHeight:19}}>
            During <Text style={{color:'#cc88ff',fontWeight:'900'}}>🌑 Dark Mode</Text>, the microphone is active.{'\n'}
            Scream, shout, or make noise → nearby ghosts <Text style={{color:'#ff4444',fontWeight:'900'}}>rush to you instantly</Text>.{'\n'}
            Stay <Text style={{color:'#88ffcc',fontWeight:'900'}}>completely silent</Text>. Your voice is your worst enemy.
          </Text>
        </View>
      </FadeIn>

      <Section label="CONTROLS" emoji="🕹️" idx={4}/>
      <Rule sym="KEY" emoji="🗝" symColor="#c9a44c" idx={4}
        title="Capture the Key"
        body="Stand near the key and hold CAPTURE for 7 seconds. Every floor has exactly one key. You need all 4 to escape."/>
      <Rule sym="UP" emoji="🛗" symColor="#a090ff" idx={5}
        title="Use the Elevator"
        body="Stand inside the elevator zone and tap LIFT. Ride freely between floors. On Floor 4 with all 4 keys → tap OPEN DOOR to win."/>
      <Rule sym="SPD" emoji="⚡" symColor="#aaffaa" idx={6}
        title="Sprint"
        body="Double-tap any direction arrow to sprint for 30 seconds. One use per speed pickup. Essential for escaping chases."/>

      <Section label="ITEMS" emoji="🎒" idx={5}/>
      <Rule sym="FRZ" emoji="❄️" symColor="#88ddff" idx={7}
        title="Freeze Charge"
        body="Walk over to collect (1 per floor). Tap FREEZE — lights on for 20s, all ghosts vanish. Best saved for a chase!"/>
      <Rule sym="PSH" emoji="💥" symColor="#ff8844" idx={8}
        title="Push Charge"
        body="Tap PUSH when a ghost is close — eliminates it instantly and earns you +1 bonus coin!"/>
      <Rule sym="BND" emoji="🩹" symColor="#88ffaa" idx={9}
        title="Bandage"
        body="Hold CAPTURE near a bandage to restore hearts. Increases your max hearts if already full (up to 5). Not on BRUTAL."/>
      <Rule sym="SHD" emoji="🛡" symColor="#44ccff" idx={10}
        title="Shield"
        body="Absorbs one ghost hit entirely. Arm it BEFORE entering danger. Available on MEDIUM, HARD, BRUTAL."/>
      <Rule sym="KLL" emoji="💀" symColor="#ff88ff" idx={11}
        title="Kill Orb"
        body="Hold CAPTURE to eliminate the nearest ghost permanently. Found on HARD and BRUTAL floors only."/>

      <Section label="COINS" emoji="🪙" idx={6}/>
      <FadeIn idx={6}>
        <View style={{gap:8,marginBottom:4}}>
          {[
            ['🏃','Survive a floor','Earn coins equal to that floor number (Floor 1=1🪙, Floor 4=4🪙)'],
            ['💥','Push a ghost','Bonus +1🪙 instantly for each ghost eliminated with PUSH'],
            ['🪙','Maze coins','Collect glowing coins scattered in the maze for +1🪙 each'],
            ['🏆','Win bonus','Escape all 4 floors → keep the full 10🪙 (1+2+3+4)'],
            ['💸','Continue cost','Die and pay coins to revive: 15🪙 → 30🪙 → 60🪙... resets each new game'],
          ].map(([em,title,desc],i)=>(
            <View key={i} style={{flexDirection:'row',gap:10,paddingHorizontal:12,paddingVertical:10,
              borderRadius:12,backgroundColor:'rgba(201,164,76,0.06)',
              borderWidth:1,borderColor:'rgba(201,164,76,0.15)'}}>
              <Text style={{fontSize:18,marginTop:1}}>{em}</Text>
              <View style={{flex:1}}>
                <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:11,marginBottom:3}}>{title}</Text>
                <Text style={{color:'rgba(255,230,180,0.65)',fontFamily:'monospace',fontSize:10,lineHeight:16}}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <Section label="GHOST TYPES" emoji="👻" idx={7}/>
      <FadeIn idx={7}>
        <View style={{gap:8,marginBottom:4}}>
          {[
            ['👻','#c8c0e8','NORMAL GHOST','Patrols its zone. Enters alert then chase when you step inside.'],
            ['💨','#ff88cc','FAST GHOST (BRUTAL)','Moves 1.5× faster. Prioritise freeze or push immediately.'],
            ['🌀','#88aaff','PHASE GHOST (HAUNTED)','Passes through all walls. You cannot outrun it in corridors.'],
            ['😱','#cc2288','PANIC GHOST','Appears when you take 2 keys too quickly. Extremely aggressive.'],
          ].map(([em,col,title,desc],i)=>(
            <View key={i} style={{flexDirection:'row',gap:12,paddingVertical:10,paddingHorizontal:12,
              borderRadius:13,backgroundColor:'rgba(15,0,5,0.65)',borderWidth:1,borderColor:col+'33',marginBottom:2}}>
              <Text style={{fontSize:22,marginTop:2}}>{em}</Text>
              <View style={{flex:1}}>
                <Text style={{color:col,fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:1,marginBottom:3}}>{title}</Text>
                <Text style={{color:'rgba(255,220,220,0.60)',fontFamily:'monospace',fontSize:10,lineHeight:16}}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <Section label="SURVIVAL TIPS" emoji="💡" idx={8}/>
      <FadeIn idx={8}>
        <View style={{gap:7,marginBottom:10}}>
          {[
            ['🗺','Plan your route during the 15s lit preview — memorise key and elevator positions.'],
            ['🛗','Ride the elevator freely — but you need ALL 4 keys to open the final exit door.'],
            ['❄','Freeze is best saved for a chase, not just collected for fun.'],
            ['🔇','In Dark Mode: breathe quietly. Any loud sound = ghost rush.'],
            ['💥','Push charges, shield, and hearts carry over between floors — use wisely.'],
            ['🌀','If there\'s a Phase Ghost — use your freeze charge the moment it spots you.'],
            ['🪙','Every coin counts — save them for continues after tough floors.'],
          ].map(([em,tip],i)=>(
            <View key={i} style={{flexDirection:'row',gap:10,paddingHorizontal:4,alignItems:'flex-start'}}>
              <Text style={{fontSize:14,marginTop:2}}>{em}</Text>
              <Text style={{color:'rgba(255,220,200,0.65)',fontFamily:'monospace',fontSize:11,lineHeight:18,flex:1}}>{tip}</Text>
            </View>
          ))}
        </View>
      </FadeIn>

    </ScrollView>
  );
}

function ProfileScreen({ profile, setProfile, charData, onEditCharacter, onPlay, openSettings, openAchievements, lh=300, lw=600 }) {
  const [name,    setName]    = useState(profile?.name ?? '');
  const [editing, setEditing] = useState(false);
  const [msg,     setMsg]     = useState('');
  const [stats,   setStats]   = useState({ escapes:0, deaths:0, bestEscapeMs:0, totalRuns:0 });
  const [coins,   setCoins]   = useState(0);

  const msToClock=(ms)=>{if(!ms||ms<=0)return'--';const s=Math.floor(ms/1000),m=Math.floor(s/60);return`${m}:${(s%60)<10?'0':''}${s%60}`;};
  const winRate = stats.totalRuns>0 ? Math.round((stats.escapes/stats.totalRuns)*100) : 0;
  const rank    = stats.escapes>5?'VETERAN SURVIVOR':stats.escapes>2?'RISING ESCAPIST':stats.escapes>0?'FLOOR RUNNER':'NEWCOMER';

  useEffect(()=>{
    setName(profile?.name ?? '');
    storage.get(STATS_KEY).then(raw=>{
      if(raw){try{const j=JSON.parse(raw);if(j)setStats(s=>({...s,...j}));}catch(e){}}
    });
    storage.get(COINS_KEY).then(raw=>{
      if(raw){try{setCoins(parseInt(raw,10)||0);}catch(e){}}
    });
  },[profile?.name]);

  const save = async()=>{
    const next={...profile, name:name.trim()||'Human'};
    setProfile(next);
    await storage.set(PROFILE_KEY, JSON.stringify(next));
    setMsg('✓ SAVED'); setEditing(false);
    setTimeout(()=>setMsg(''),1400);
  };

  const isSmall  = lh < 320;
  const PANEL_W  = Math.round(lw * (isSmall ? 0.28 : 0.30));
  const cardPad  = isSmall ? 10 : 14;
  const gap      = isSmall ? 6  : 9;

  const Divider = ({label}) => (
    <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3}}>
      <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
      <Text style={{color:'rgba(201,164,76,0.38)',fontFamily:'monospace',fontSize:7,letterSpacing:3}}>{label}</Text>
      <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
    </View>
  );

  const ActionBtn = ({label, emoji, sub, onPress, accentColor, borderColor, bgColor}) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.80}
      style={{
        flexDirection:'row', alignItems:'center', gap:10,
        paddingVertical:isSmall?9:11, paddingHorizontal:isSmall?10:13,
        borderRadius:13, backgroundColor:bgColor,
        borderWidth:1.5, borderColor,
      }}>
      <Text style={{fontSize:isSmall?16:19, width:24, textAlign:'center'}}>{emoji}</Text>
      <View style={{flex:1}}>
        <Text style={{color:accentColor, fontFamily:'monospace', fontWeight:'900',
          fontSize:isSmall?8:10, letterSpacing:1}}>{label}</Text>
        {!!sub && <Text style={{color:'rgba(255,255,255,0.25)',fontFamily:'monospace',
          fontSize:6,marginTop:1}}>{sub}</Text>}
      </View>
      <Text style={{color:'rgba(255,255,255,0.15)',fontSize:13}}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{flex:1, flexDirection:'row', paddingHorizontal:6, paddingVertical:6, gap:gap}}>

      {/* ════ LEFT — Avatar + identity ═════════════════════════════════ */}
      <View style={{width:PANEL_W, gap:gap, justifyContent:'center'}}>

        {/* Identity card */}
        <View style={{
          borderRadius:16, padding:cardPad, alignItems:'center', gap:8,
          backgroundColor:'rgba(201,164,76,0.06)',
          borderWidth:1.5, borderColor:'rgba(201,164,76,0.20)',
        }}>
          {/* Avatar */}
          <View style={{
            width: isSmall?56:66, height:isSmall?56:66,
            borderRadius: isSmall?17:20,
            backgroundColor:'rgba(0,0,0,0.50)',
            borderWidth:2, borderColor:'rgba(201,164,76,0.42)',
            justifyContent:'center', alignItems:'center',
            shadowColor:'#c9a44c', shadowRadius:10, shadowOpacity:0.3,
          }}>
            {charData
              ? <ChibiCharacter charData={charData} size={isSmall?1.08:1.28}/>
              : <Text style={{color:'rgba(255,255,255,0.18)',fontSize:24}}>?</Text>}
          </View>

          {/* Name / edit */}
          {editing ? (
            <View style={{width:'100%', gap:6}}>
              <TextInput
                value={name} onChangeText={setName} autoFocus maxLength={20}
                style={{
                  color:'#e8dcc8', fontFamily:'monospace', fontWeight:'900',
                  fontSize:13, textAlign:'center',
                  backgroundColor:'rgba(255,255,255,0.07)',
                  borderRadius:10, paddingHorizontal:10, paddingVertical:7,
                  borderWidth:1.5, borderColor:'#c9a44c',
                }}/>
              <View style={{flexDirection:'row', gap:6}}>
                <TouchableOpacity onPress={save}
                  style={{flex:1,backgroundColor:'#c9a44c',borderRadius:10,paddingVertical:7,alignItems:'center'}}>
                  <Text style={{color:'#07060f',fontFamily:'monospace',fontWeight:'900',fontSize:10}}>SAVE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>setEditing(false)}
                  style={{width:34,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:10,paddingVertical:7,alignItems:'center'}}>
                  <Text style={{color:'rgba(255,255,255,0.5)',fontSize:11}}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={()=>setEditing(true)} style={{alignItems:'center',gap:4}}>
              <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',
                fontSize:isSmall?13:15,letterSpacing:1}} numberOfLines={1}>
                {name||'Human'}
              </Text>
              <View style={{
                borderWidth:1,borderColor:'rgba(201,164,76,0.35)',
                borderRadius:6,paddingHorizontal:8,paddingVertical:2,
              }}>
                <Text style={{color:'rgba(201,164,76,0.55)',fontFamily:'monospace',fontSize:6,letterSpacing:2}}>
                  ✏ TAP TO EDIT
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {!!msg && <Text style={{color:'#19C37D',fontFamily:'monospace',fontWeight:'900',fontSize:9,letterSpacing:2}}>{msg}</Text>}

          {/* Rank badge */}
          <View style={{
            paddingHorizontal:10,paddingVertical:4,borderRadius:8,
            backgroundColor:'rgba(255,255,255,0.05)',
            borderWidth:1,borderColor:'rgba(255,255,255,0.08)',
          }}>
            <Text style={{color:'rgba(255,255,255,0.28)',fontFamily:'monospace',fontSize:6,letterSpacing:2,textAlign:'center'}}>
              {rank}
            </Text>
          </View>

          {/* Coin display */}
          <View style={{
            flexDirection:'row',alignItems:'center',gap:6,
            paddingHorizontal:12,paddingVertical:5,borderRadius:14,
            backgroundColor:'rgba(201,164,76,0.12)',
            borderWidth:1,borderColor:'rgba(201,164,76,0.30)',
          }}>
            <Text style={{fontSize:13}}>🪙</Text>
            <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:isSmall?14:17}}>
              {coins}
            </Text>
          </View>
        </View>
      </View>

      {/* ════ RIGHT — Stats + Actions ══════════════════════════════════ */}
      <View style={{flex:1, gap:gap, justifyContent:'center'}}>

        <Divider label="YOUR STATS"/>
        {/* Stat grid 2x2 */}
        <View style={{gap:5}}>
          {[
            [{label:'ESCAPES', val:stats.escapes,             color:'#c9a44c', bg:'rgba(201,164,76,0.07)'},
             {label:'WIN %',   val:`${winRate}%`,             color:'#5ecfa0', bg:'rgba(94,207,160,0.07)'}],
            [{label:'DEATHS',  val:stats.deaths,              color:'#ff6666', bg:'rgba(255,80,80,0.07)'},
             {label:'BEST',    val:msToClock(stats.bestEscapeMs), color:'#88ddff', bg:'rgba(100,180,255,0.07)'}],
          ].map((row,ri)=>(
            <View key={ri} style={{flexDirection:'row',gap:5}}>
              {row.map(c=>(
                <View key={c.label} style={{
                  flex:1, borderRadius:11, paddingVertical:isSmall?6:8, paddingHorizontal:5,
                  backgroundColor:c.bg, borderWidth:1, borderColor:c.color+'26',
                  alignItems:'center', gap:2,
                }}>
                  <Text style={{color:c.color,fontFamily:'monospace',fontWeight:'900',
                    fontSize:isSmall?13:16,lineHeight:isSmall?15:19}}>{c.val}</Text>
                  <Text style={{color:'rgba(255,255,255,0.25)',fontFamily:'monospace',
                    fontSize:6,letterSpacing:1.5}}>{c.label}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <Divider label="ACCOUNT"/>
        {/* Action buttons */}
        <View style={{gap:isSmall?5:6}}>
          <ActionBtn
            label="EDIT CHARACTER" emoji="🎭"
            sub="Change appearance"
            onPress={onEditCharacter}
            accentColor='#c9a44c' borderColor='rgba(201,164,76,0.30)' bgColor='rgba(201,164,76,0.07)'
          />
          <ActionBtn
            label="ACHIEVEMENTS" emoji="🏆"
            sub="View your trophies"
            onPress={openAchievements}
            accentColor='#b0a0ff' borderColor='rgba(160,140,255,0.30)' bgColor='rgba(100,80,255,0.06)'
          />
          <ActionBtn
            label="SETTINGS" emoji="⚙️"
            sub="Mic · audio · data"
            onPress={openSettings}
            accentColor='rgba(255,255,255,0.55)' borderColor='rgba(255,255,255,0.10)' bgColor='rgba(255,255,255,0.03)'
          />
        </View>
      </View>

    </View>
  );
}
function IntroVideoScreen({ onDone }) {
  const { width: VW, height: VH } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const doneCalledRef = useRef(false);

  const finish = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    try { const el = document.getElementById('__tlf_vid'); if(el) el.remove(); } catch(e){}
    Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(()=>{ onDone(); });
  }, [fadeAnim, onDone]);

  // Restore video for iOS/Android — require() works on native Expo Go
  let videoSource = null;
  try { videoSource = require('./assets/Video_Animation_With_Blue_Tones.mp4'); } catch(e) {}

  // Auto-skip safety net
  useEffect(()=>{
    const t = setTimeout(finish, 12000);
    return ()=>clearTimeout(t);
  }, [finish]);

  // Web: inject a native <video> element — only way to get true full-screen fill on web
  useEffect(()=>{
    if(Platform.OS !== 'web' || !videoSource) return;
    try{
      const old = document.getElementById('__tlf_vid');
      if(old) old.remove();
      const v = document.createElement('video');
      v.id = '__tlf_vid';
      v.src = videoSource;
      v.autoplay = true;
      v.playsInline = true;
      v.muted = false;
      v.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:999999;background:#000;';
      v.onended = finish;
      v.onerror = finish;
      document.body.appendChild(v);
    }catch(e){ finish(); }
    return()=>{ try{ const el=document.getElementById('__tlf_vid'); if(el) el.remove(); }catch(e){} };
  },[]);

  return (
    <Animated.View style={{
      position:'absolute', top:0, left:0,
      width:VW, height:VH,
      backgroundColor: Platform.OS==='web' ? 'transparent' : '#000',
      opacity:fadeAnim,
      zIndex:9999,
    }}>
      <StatusBar hidden />

      {/* Native mobile video only */}
      {Platform.OS !== 'web' && Video && videoSource && (
        <Video
          source={videoSource}
          style={{ position:'absolute', top:0, left:0, width:VW, height:VH }}
          resizeMode="cover"
          shouldPlay
          isLooping={false}
          isMuted={false}
          onPlaybackStatusUpdate={(s)=>{ if(s?.didJustFinish||s?.error) finish(); }}
          onError={finish}
        />
      )}

      {/* Fallback if no video file found */}
      {!videoSource && (
        <View style={{ width:VW, height:VH, justifyContent:'center', alignItems:'center', backgroundColor:'#000' }}>
          <Text style={{ color:'#e8dcc8', fontFamily:'monospace', fontWeight:'900', fontSize:48, letterSpacing:8, marginBottom:20 }}>TLF</Text>
          <Text style={{ color:'#e8dcc8', fontFamily:'monospace', fontWeight:'900', fontSize:26, letterSpacing:7, textAlign:'center', lineHeight:38 }}>
            THE LAST{'\n'}FLOOR
          </Text>
        </View>
      )}

      {/* Tap to skip */}
      <TouchableOpacity onPress={finish} activeOpacity={1}
        style={{ position:'absolute', top:0, left:0, width:VW, height:VH, zIndex:9999999 }}/>
      <View style={{ position:'absolute', bottom:28, right:28, zIndex:9999999 }} pointerEvents="none">
        <Text style={{ color:'rgba(255,255,255,0.4)', fontFamily:'monospace', fontSize:11, letterSpacing:2 }}>
          TAP TO SKIP ▶
        </Text>
      </View>
    </Animated.View>
  );
}

function LaunchScreen({ onReady, bootDone }){
  useEffect(()=>{
    if(bootDone && onReady) onReady();
  },[bootDone]);
  return(
    <View style={{flex:1,backgroundColor:'#03020a',justifyContent:'center',alignItems:'center'}}>
      <StatusBar hidden/>
      <Text style={{color:"#c9a44c", fontFamily:"monospace", fontWeight:"900", fontSize:48, letterSpacing:6}}>TLF</Text>
      <Text style={{marginTop:10,color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',letterSpacing:7,fontSize:18}}>LAST FLOOR</Text>
      <Text style={{marginTop:10,color:'rgba(255,255,255,0.35)',fontFamily:'monospace',fontSize:10}}>Loading...</Text>
    </View>
  );
}

function TypingIntro({ name, onDone }) {
  const {width:VW, height:VH} = useWindowDimensions();
  const onDoneRef = useRef(onDone);
  useEffect(()=>{ onDoneRef.current = onDone; },[onDone]);

  // Animation values
  const bgFade    = useRef(new Animated.Value(0)).current;
  const line1Op   = useRef(new Animated.Value(0)).current;
  const line1Y    = useRef(new Animated.Value(30)).current;
  const line2Op   = useRef(new Animated.Value(0)).current;
  const line2Y    = useRef(new Animated.Value(30)).current;
  const credOp    = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lineW     = useRef(new Animated.Value(0)).current;

  // Typing state for three text sections
  const [typedReady,  setTypedReady]  = useState('');
  const [typedDesc,   setTypedDesc]   = useState('');
  const [typedWelcome,setTypedWelcome]= useState('');
  const FULL_WELCOME = `WELCOME, ${(name||'SURVIVOR').toUpperCase()}`;
  const FULL_READY   = 'READY?';
  const FULL_DESC    = '4 floors. Real ghosts. No second chances.\nFind the key. Reach the elevator. Escape.';

  const animIn = (op, y, delay) => Animated.parallel([
    Animated.timing(op, {toValue:1, duration:500, delay, useNativeDriver:true}),
    Animated.timing(y,  {toValue:0, duration:400, delay, easing:Easing.out(Easing.cubic), useNativeDriver:true}),
  ]);

  useEffect(()=>{
    let alive = true;
    // Phase 1: bg fade in, then type welcome line
    Animated.timing(bgFade, {toValue:1, duration:700, useNativeDriver:true}).start(()=>{
      if(!alive) return;
      // Type WELCOME text
      let i=0;
      const typeWelcome = setInterval(()=>{
        if(!alive){clearInterval(typeWelcome);return;}
        i++;
        setTypedWelcome(FULL_WELCOME.slice(0,i));
        if(i>=FULL_WELCOME.length){
          clearInterval(typeWelcome);
          // After welcome done, fade in "ARE YOU" + type READY?
          setTimeout(()=>{
            if(!alive) return;
            Animated.parallel([
              Animated.timing(line2Op,{toValue:1,duration:400,useNativeDriver:true}),
              Animated.timing(line2Y, {toValue:0,duration:350,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
            ]).start(()=>{
              if(!alive) return;
              // Type READY?
              let j=0;
              const typeReady = setInterval(()=>{
                if(!alive){clearInterval(typeReady);return;}
                j++;
                setTypedReady(FULL_READY.slice(0,j));
                if(j>=FULL_READY.length){
                  clearInterval(typeReady);
                  // Animate divider line, then type description
                  Animated.timing(lineW,{toValue:1,duration:600,useNativeDriver:false}).start(()=>{
                    if(!alive) return;
                    let k=0;
                    const typeDesc = setInterval(()=>{
                      if(!alive){clearInterval(typeDesc);return;}
                      k++;
                      setTypedDesc(FULL_DESC.slice(0,k));
                      if(k>=FULL_DESC.length){
                        clearInterval(typeDesc);
                        // Show credits then done
                        setTimeout(()=>{
                          if(!alive) return;
                          Animated.timing(credOp,{toValue:1,duration:700,useNativeDriver:true}).start(()=>{
                            setTimeout(()=>{ if(onDoneRef.current) onDoneRef.current(); },1600);
                          });
                        },300);
                      }
                    },28);
                  });
                }
              },90);
            });
          },300);
        }
      },55);
    });

    // Pulse the READY? word once it's visible
    const loop=()=>Animated.sequence([
      Animated.timing(pulseAnim,{toValue:1.08,duration:700,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:1.0, duration:700,useNativeDriver:true}),
    ]).start(loop);
    const pt = setTimeout(loop, 2800);
    return ()=>{ alive=false; clearTimeout(pt); };
  },[]);

  const lineWPct = lineW.interpolate({inputRange:[0,1], outputRange:['0%','60%']});

  return(
    <Animated.View style={{
      flex:1, backgroundColor:'#020108',
      justifyContent:'center', alignItems:'center',
      opacity:bgFade,
    }}>
      <StatusBar hidden/>

      {/* Subtle scanline overlay */}
      <View style={{position:'absolute',top:0,left:0,right:0,bottom:0}} pointerEvents="none">
        {Array.from({length:Math.ceil(VH/4)}).map((_,i)=>(
          <View key={i} style={{height:1, backgroundColor:'rgba(255,255,255,0.015)', marginBottom:3}}/>
        ))}
      </View>

      <View style={{alignItems:'center', paddingHorizontal:Math.round(VW*0.05), gap:0}}>

        {/* Line 1 — typed greeting */}
        <Text style={{
          color:'rgba(255,255,255,0.35)', fontFamily:'monospace',
          fontSize:Math.round(Math.max(9,Math.min(12,VH*0.022))), letterSpacing:5,
          marginBottom:Math.round(VH*0.035), minHeight:20,
        }}>
          {typedWelcome}<Text style={{opacity: typedWelcome.length < FULL_WELCOME.length ? 1 : 0}}>▌</Text>
        </Text>

        {/* ARE YOU + typed READY? */}
        <Animated.View style={{opacity:line2Op, transform:[{translateY:line2Y}], alignItems:'center', marginBottom:8}}>
          <Text style={{color:'rgba(255,255,255,0.18)', fontFamily:'monospace', fontSize:Math.round(Math.max(8,Math.min(12,VH*0.02))), letterSpacing:6, marginBottom:10}}>
            ARE YOU
          </Text>
          <Animated.Text style={{
            color:'#e8dcc8', fontFamily:'monospace', fontWeight:'900',
            fontSize:Math.round(Math.max(36,Math.min(58,VH*0.14))), letterSpacing:4,
            transform:[{scale:pulseAnim}],
            textShadowColor:'rgba(201,164,76,0.3)', textShadowRadius:20,
            minHeight:Math.round(Math.max(36,Math.min(58,VH*0.14)))+4,
          }}>
            {typedReady}<Text style={{color:'rgba(201,164,76,0.8)',opacity:typedReady.length>0&&typedReady.length<FULL_READY.length?1:0}}>▌</Text>
          </Animated.Text>
        </Animated.View>

        {/* Animated divider line */}
        <Animated.View style={{height:1.5, width:lineWPct, backgroundColor:'rgba(201,164,76,0.5)', borderRadius:1, marginVertical:Math.round(VH*0.03)}}/>

        {/* Typed description */}
        <Text style={{
          color:'rgba(255,255,255,0.5)', fontFamily:'monospace',
          fontSize:Math.round(Math.max(10,Math.min(13,VH*0.025))), letterSpacing:2,
          textAlign:'center', lineHeight:Math.round(Math.max(16,Math.min(22,VH*0.038))),
          maxWidth:Math.min(400, VW*0.85), marginBottom:Math.round(VH*0.04),
          minHeight:Math.round(Math.max(16,Math.min(22,VH*0.038)))*3,
        }}>
          {typedDesc}<Text style={{opacity:typedDesc.length>0&&typedDesc.length<FULL_DESC.length?1:0}}>▌</Text>
        </Text>

        <Animated.View style={{opacity:credOp, marginBottom:Math.round(VH*0.03), alignItems:'center',
          paddingHorizontal:Math.round(VW*0.04),paddingVertical:Math.round(VH*0.02),borderRadius:14,
          backgroundColor:'rgba(255,30,30,0.10)',borderWidth:1.5,borderColor:'rgba(255,80,80,0.40)',
          maxWidth:Math.min(380, VW*0.9),
        }}>
          <Text style={{color:'#ff6666',fontFamily:'monospace',fontWeight:'900',fontSize:Math.round(Math.max(11,Math.min(14,VH*0.028))),letterSpacing:3,marginBottom:6}}>
            STAY SILENT
          </Text>
          <Text style={{color:'rgba(255,200,200,0.75)',fontFamily:'monospace',fontSize:Math.round(Math.max(9,Math.min(11,VH*0.022))),lineHeight:Math.round(VH*0.032),textAlign:'center'}}>
            {'During Dark Mode, if you scream or make loud sounds,ghosts WILL hear you and rush to your location. Keep your voice down — or suffer the consequences.'}
          </Text>
        </Animated.View>

        <Animated.View style={{opacity:credOp, alignItems:'center', gap:5}}>
          <Text style={{color:'rgba(255,255,255,0.2)', fontFamily:'monospace', fontSize:Math.round(Math.max(7,Math.min(9,VH*0.016))), letterSpacing:4}}>
            CREATED BY
          </Text>
          <Text style={{color:'rgba(201,164,76,0.8)', fontFamily:'monospace', fontWeight:'900', fontSize:Math.round(Math.max(12,Math.min(15,VH*0.030))), letterSpacing:3}}>
            Zahraa · Waad · Renad
          </Text>
          <Text style={{color:'rgba(255,255,255,0.15)', fontFamily:'monospace', fontSize:Math.round(Math.max(7,Math.min(9,VH*0.016))), letterSpacing:2, marginTop:3}}>
            We made you something special. Enjoy.
          </Text>
        </Animated.View>

      </View>
    </Animated.View>
  );
}

function NameSetup({ initialName, onSave, onBack }) {
  const [name, setName] = useState(initialName || '');
  const { width: W, height: H } = useWindowDimensions();
  const LW = Math.max(W, H);
  const LH = Math.min(W, H);
  const can = !!String(name).trim();

  return (
    <View style={{ width: LW, height: LH, backgroundColor: '#070615', flexDirection: 'row' }}>
      <StatusBar hidden />

      {/* LEFT — branding panel */}
      <View style={{
        width: LW * 0.42, height: LH,
        justifyContent: 'center', alignItems: 'center',
        borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 24,
        gap: 10,
      }}>
        <View style={{
          width: 64, height: 64, borderRadius: 20,
          backgroundColor: 'rgba(201,164,76,0.12)',
          borderWidth: 1.5, borderColor: 'rgba(201,164,76,0.35)',
          justifyContent: 'center', alignItems: 'center', marginBottom: 6,
        }}>
          <Text style={{ fontSize: 28 }}>👤</Text>
        </View>
        <Text style={{ color: '#c9a44c', fontFamily: 'monospace', fontWeight: '900', fontSize: 11, letterSpacing: 5, textAlign: 'center' }}>
          THE LAST FLOOR
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 10, textAlign: 'center', lineHeight: 16 }}>
          Enter your name to begin your escape
        </Text>
      </View>

      {/* RIGHT — form panel */}
      <View style={{
        flex: 1, height: LH,
        justifyContent: 'center', paddingHorizontal: 28, gap: 14,
      }}>
        <Text style={{ color: '#e8dcc8', fontFamily: 'monospace', fontWeight: '900', fontSize: 16, letterSpacing: 4 }}>
          YOUR NAME
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', fontSize: 10, marginTop: -8 }}>
          This is how ghosts will remember you.
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter name..."
          placeholderTextColor="rgba(255,255,255,0.22)"
          autoFocus
          maxLength={20}
          style={{
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 13,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderWidth: 1.5,
            borderColor: name.trim() ? '#c9a44c' : 'rgba(255,255,255,0.12)',
            color: '#e8dcc8',
            fontFamily: 'monospace',
            fontSize: 16,
            fontWeight: '900',
            letterSpacing: 2,
          }}
        />

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.85}
            style={{
              flex: 1, paddingVertical: 13, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center',
            }}>
            <Text style={{ color: 'rgba(255,255,255,0.60)', fontFamily: 'monospace', fontWeight: '900', letterSpacing: 2, fontSize: 11 }}>← BACK</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onSave(can ? String(name).trim() : 'Human')}
            activeOpacity={0.85}
            style={{
              flex: 2, paddingVertical: 13, borderRadius: 12,
              backgroundColor: can ? '#c9a44c' : 'rgba(255,255,255,0.04)',
              borderWidth: 1.5, borderColor: can ? '#c9a44c' : 'rgba(255,255,255,0.10)',
              alignItems: 'center',
            }}>
            <Text style={{ color: can ? '#03020a' : 'rgba(255,255,255,0.30)', fontFamily: 'monospace', fontWeight: '900', letterSpacing: 3, fontSize: 12 }}>
              {can ? `SAVE  →` : 'TYPE A NAME'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}



const WORLD_W = 3200;  // Wider world — rectangular landscape feel
const WORLD_H = 1400;  // Shorter height for wide corridors
const PLAYER_R   = 22;
const PLAYER_SPD = 3.8; // faster movement
const ENEMY_R    = 28;
const GHOST_SPD_PATROL = 2.8;   // active wander inside zone (was 2.2)
const GHOST_SPD_ALERT  = 3.0;   // noticed player — moving toward edge
const GHOST_SPD_CHASE  = 4.4;   // actively chasing
const GHOST_ZONE_SENSE  = 240;  // player entering zone triggers ALERT
const GHOST_CHASE_RANGE = 380;  // once alert, if player this close → CHASE
const GHOST_FORGET_DIST = 600;  // player this far → ghost returns to patrol
const GHOST_ALERT_LINGER = 3000; // ms ghost stays ALERT after losing sight
const ENEMY_HIT_COOLDOWN_MS = 900;
const VISION_RADIUS         = 300;
const ENEMY_SHOW_RADIUS     = 360;
const INTERACT_RADIUS       = 85;

// ── HOLD INTERACTIONS ─────────────────────────────────────────────────────────
const KEY_HOLD_MS        = 7000;   // 7s to capture key
const BANDAGE_HOLD_MS    = 5000;
const SPEED_HOLD_MS      = 5000;
const SHIELD_HOLD_MS     = 5000;
const KILL_ORB_HOLD_MS   = 800;   // keep fast, combat item
// ── HEARTS ───────────────────────────────────────────────────────────────────
const MAX_HEARTS         = 3;     // start with 3 hearts
const MAX_HEARTS_CAP     = 5;     // bandage can increase max hearts up to 5

// Keep the existing array for any legacy logic, but start is 3 everywhere
const FLOOR_START_HEARTS = [3, 3, 3, 3];

// ── SPEED POWER (SPRINT) ─────────────────────────────────────────────────────
// Sprint is ONE-TIME USE per speed pickup. Double-tap activates it for 30s.
// Collecting a new speed pickup resets the usage.
const DOUBLE_TAP_WINDOW_MS = 260;
const SPRINT_DURATION_MS   = 30000; // 30 seconds

// ── RANDOM DARK + MIC MODE ───────────────────────────────────────────────────
const DARKMIC_COUNTDOWN_SEC   = 5;
const DARKMIC_DURATION_MS     = 30000;
const DARKMIC_CHECK_EVERY_MS  = 9000;
const DARKMIC_TRIGGER_CHANCE  = 0.12;

// Per-floor freeze duration (auto-collect, no hold): 10s / 7s / 5s / none
const FLOOR_FREEZE_DURATION = [10000, 7000, 5000, 0];

const PANIC_DELAY_MS    = 5 * 60 * 1000;
const PANIC_DURATION_MS = 60 * 1000;
const PANIC_EXTRA_ENEMIES = 3;

const MIC_ENABLED_DEFAULT = true;
const MIC_POLL_MS         = 220;
const MIC_THRESHOLD_DB    = -28;
const MIC_LURE_RADIUS     = 500;
const MIC_ENEMY_SPD_BOOST = 1.4;

// Audio files embedded as base64 data URIs — works in Expo Snack with no extra files needed
const STEPS_DATA_URI    = 'data:audio/mp3;base64,//vQRAAM5Gd6qxGINtKf7uUhGYisVrH82hTEgAL0vdsCnsAAGVm6/30mFMpLBmxDav9fbdO2rG45em2rascbn9+tHqCLx0J5w2xC1E48VfC3aPExN1V18LZhjxVyyjzzHj+WHjj0fGByFgJgsDspTqdP/+e////4kYKicLh4Lo6Ojz//O8VdXVo33HYs5QwnH/ysVcWzlGhx5C2fWla1bm5////3bIep3Ni9zf3aVpxUBE1mycRDjEE8qVqTIFStA8wskGGJofcZXGh4dwV+jaE6iVuXps2rE+5el4KxvsbkLTJ8aFgzY3NyF59xtiFCOScRA8EtJDmwMmyCaK3H6piSNwNg0K6Za9E/ScmFtBrD6tHT7urp0mP//6W6tHibfiWVlPPSY4lhw49Hif//iWqnSYm6tlZWNFg9C4EwWB2UrKxgoNKNHjh5h48cPpYMmVCAcgmA9CZKQEB/QwblIRFA4DptlAQDDH1MLiQQCSeI1E55QUDCAgMCtKQjPubLgm1D9IUGJ71BWjnOoo0ZPGoCAMQzbgUFEZ0qG5N79IAwxdapF7E1GCBG31GJ/+SBM3CcmLvc8MpiMSMVk++0dVl7C5r75o0b4XPo2/5t//9cVk7fphv/1BAgg2kgYhc4IEaOc6hlzzUCAUKo6QbCH/v+EC4rJydKO/7/6gQBtuGEBhGcJFMQ4I4DkAwHhAivyeACcNORvUaQWXyGJiQAIRTYECqBMD5oVDRfMze0bl6Qr7RHZ45RZq9MTNvnNmb9N+lX6XgcbM3KYIBYO1dJbfYr7CwSDyyxO/6Q8rkES8zVwGCwwP35Ycv8zlJOHJlgwJ5/Rtevvf/veaddg8gcmZnW/+ksLIvWd17UbP18azJm97/Rtyiyja+BZT8m+a/Tt+b4w5C/NISekQ1yJ+YSWT3jByZmZvCZoTr95vMzuGCpQdvqAQQAggfmUuM9B/HoetJT1HEIcNKADLCCkqbpzBAcykVxhyiri4JpsyqDKSenHbAz5goiRfLFmjh67jtVQHPpaBgFm/P4WbNNN5XVHkkFzoUMJzsV69iI16flA/dMq9sbjpoJnl1NTFLUmK2cvd+GJyX0L9ooCgQOIS4CgQCMUv/70mQ/gAk6ijwWbyAAqBFH0MS0ACLmGxm5vAACNsJh5waAAMvUljCi7VtfcvRl9KfPt7ZgjmSGW3UNWPImbM4ic5Xt5XKfLHG9NRipSQ/lRZ25/dMl4XciaNDK408K648le0ixemqlfVn8rdL2d7O7sy/uG+1Y3ap8+2us0VIySfXeytWNUEvlrS2/Zwq5VTG7G+Y0v6lcjw+5W7Sf///////4SuWRWKPx9eDdM0mIw0+7b////////VxbXY/cmfv4NjqgircmLMsqQtHAeXaFZcvTIqkyT/XTcvpoJmR6pymZGQ5BcpzdBlpkYZxhi8eWqtJA8ZulKZ9VJnWkgcQdnOj3jDkoR+gm7JJIm5cLhYcE9Lg7BkhMR1petBit2dbuggaJGB9RQQcv96vau6DKQ1malJmxmjampVdab/6mas+pepmWopUnN3NFJJGSzQxdNlslU/ouh/+mYIKPG9NV1pmC3//LxLCXmJdJSV03jIM0C2yyxyt2xTS7SNwpNJAka2UuQMeGbIBtG0aQEMSeUyQOMmEjTgIiSIlMJ3tPAQaJAUimnuiAKkqrDqSDZmxxBcjDwVdEyxB1qAlSUCxFrJYhlwqNr9qKQFEp5qLvI9q5U4QwBkFmj60fGuT92zuIt3ezVlyqCMxRwkREL0BlJXrvpE8a7v2Y6yNrjUG5Xqalg0tO0aHcLOPL1TKxWfjDCI0tuNyunDMJFt/OufGLsmgfOn3Z3LcZZZt09SnmYtfmLlblvk3KqaKReDotO2aCV//673PPd3Hv6/KzjYleeF3Pv9vVeWrlmbpc7E9OUmNPjS0nNd1///6/8v/////////97////+5/8//////////1y5jj/PtikaAAAADI6IIAAAIQW4or07c8ze1+6W6WEeHNGCETdG6+cYTF4sIINBHFCbSvR7q1ggG8kRFoO4Ww7HhTJCJgaBEgdCALQHYKxYka9/czcDJjWKNN16ZIqK+t/+uKna6473S4fiKbh+u4buo2ll33iYvuOrP5+YJ/vQZf/8L/////wdd//wf/////5I2lPiZNSyS006TYdSYdYkgipEqUsQG2GHLgQUwUAh3NNWuSAsmUPWsXrXc1l1XO//vSZBWAODp4RednAAByzago4wwA4KH9DQ09M8HhPyDgMIyZdhKqfmIKWk97kuTGmnKbODLJh4GpQRKJ4rA5a5WOt1hD3LeZBbcZrCvpoMStJId/HZZ26kOzrwuq4jswdDOcPNXlr3NNTFXY7sCX4ditMzlhrEX3ZbEZJXeWvWq0rBWHTbsy57KkBRSrKaJ3ZdHHpidiV4ztjk7cprePaSmv3b1JWprmFrC7n2rJq8S+rJLtSdinaKtd5alXJvOpNVpTuxKorlyVWZnGesyflrc7lG5VYuQ1UppdQyq9dmq89TUlqltTuGv7h/cOc1vn95zu9c1ln3PHL8M6hkWjJ8AIAAAkDUW+lG62N2z965eqZ9N3K55IJKF7ixwWDFBm9hBmFGj01BOEOa1S3UIuoRnDgIl0tVSjdhGz1lzNr084zz9b5ax/Jb7uRVKuVi5F3Lvtcz39fmeWZV7xwkfOanWpaW+0rRxcS0nq6v7v6hM6reh6umAAPMgEtAHXGLPk0MiPq/NeVMyTMUOCxZYiaSAFXyda8zBh4AYGi1Aqi7N2DQ0N9gJbo/25SlkOYt5iDpNctoj6EH8EaSK7LCxMSPYFSTIdjAzHY3uD1CD1L6SculgvDhTr1ZiMaWYkMZ45ByaJ460TY+TNPFvSa5H7KejI4rhgOAxUKXJyRlSfz9gfqNEUO9va1quGFzXYXQEgVcZG6Nn1jiZGWURYBBSTaFF0AusKFBiexI5uQnUiORHSuEK+lxhBrxMkmaXRoiFR4ZLHR9ls+TyTZXMHyI4OkxEsFDaNzlW2khEUGO8iQICBEg4fRE60kDmipRBeitTWmLbNwQ6qbT0ABQgQUEzLbp78HwyeHGOCOz1GCYiABmEco0jvM44fYOQ4wIhEIY7pEciQrhphg6E4IjKB92+gsQ35tSP0Sv30IizknFe6m/+SUvV5/3csPSy8lF96HSMfgx+De6Hn0h/KFkZglU4cFIleHDMEuePHVppq6ixphEUqS7/gAANEMtAC60yoEDkzULASdUzU3FQKYokkMYWZGYMUiUFQaF9RCp+octJXwNSm5ITY9zIBzqdsXJEk+Buj5HCWByOEh4j5C0Fg5VG2HA/L+m3/+9JkKYM4dH5Dw09k8ogvqDUgw64hVf0QjL2RQgq+oSCQjIFOXFLjOL5lzPw84ZwKhXNKimfTtxknIwsqGH8Yrcxu1wlkNKk30IV6jbTzU5bMIo3FEe8VD0+yIYqCXk0ak6/24P2ZFqtyNlxaVHZbKac6HRcOdiscJyuDTztSvLplGkXjZS+TyseNoTDxLRrFZyfpEca9FBxdXGloC2YVPTyBghozxt08k04pRL1K1ALxXNGHUZmcHy/ljLCGZtJY9MjhxISKQRn7KLG1nOKoDhppTdcexrocc04UnhtRkCgABFeSyaPbqPkYi2MH79xCikQYki0VNziTJmntvir0pc0as7O/qpmtzJ6Zt4d63UTNIRwudlp8VcXRft4afMwRXMXWPKOO2JtVapIuj1vCevpywzBBDswm3nyxEpnXKBVHMIkrmgLQt6FtpRc67w/K9VaZDnhZudMeigbggYM4JwUBkx3AfBEIJswg4iDaiN5I0wTjCHAjMCU3LukURRmRCjgoGBDGHiewsyNHrIAoKE5EkFIMei7LsQw+C3Eu2W4ux8D7FhL8j0CeJXK5gNBiW1StXZy/pwvh0t4nh1Ien2a6rOowjloOJUBo6vMySaFsrjjGTCw42QD5WpOC4EKsNBzDIcVqtw3UsHhsRSREVh8UEdMVCiJB4kQhgMF68pUHZsSlg/Q3gPVJ8tN6KXLDqrPjpkrIHoy000VIkzCRGjMEyp1IX15ZLpTLy8qwqOO6JmzssJyidD1yaE5o6tkRIDhoyPUt1a4loKthATmp+0rsVFuUKzDaqE0THGJforTchienh8tXw9WNMJ6UPTg/b4AkEB4gQNr4CGHeGtLECDtQ2IgCmBagYhApSaI6bGiVsDJHFixdIIb0OLCghAJEwAW90MhCY4N8BI3BkRk9NUMs2yIT3pePwNoWvFLU6lcxESjUoyl246GZDbA1stuRZP0jcUbtn3IQljlK8ZofDxHdWdzgImJIfnlr1gRibUSqyYgvSYcaYBGMmKAxhxIEIQJCTAgIxEKLVpmhccDgJFIqgqyEKZwuqLBClSZ6TaczxNEkzrsZRK4hjxDQgBqpwR8sKBNQfFy4C7ow+Hj6BHSFRf/70mQngziXf0Qjb2Twgs8IWBjDbmId+RKNPZGKEr5hQJANAYGY/j1WC9ptGKs2U42nmqEcYaoUTifmV9nL6nk+yzI+Y0jmN3SoN0606ho62ViLehTGwpZPm8fUeowiSXTqGyqJQNmXJjgODC1trlqkSjAzKwiyJLxzQJEM+IQ9GzBZSQryIUnYRwZhVLDMVniGQm0h96xoxROqSkVTajQjr1aw2MixYvIVbDyWywcrCyvJLRNbqOJgiTcZklEuokxPE+WSc46Vlqo4JDS9DJaRa+lYXXPXlhIMUkJSaOPQ332WHoSq9sYQqAAAmkZyRhwG9OzvXe+0Zm5iMqheJ1tztbpBPI8+pK7Q2o9NI6060akNEUDQiK0n3zUmhhNWscgdJhgRKe8ZoFZ7DFomRQZ0rqWyO1TTtKdmC8TVzaDeZERb0g59xjyVDooopD12Ngi+dHJAWCquSTKxYHhnfySBC2BRiCt+yE6O0ATI0iBcoPLiZCPCzHhQMSCplSseBBYYmkCkxjQhCIUvT7T0HgRMLRZRcliAGHDNg0QviWQRaTbEIUQbgS0yy+iXimaLyMoT3J+UbYgkMSTIh6fHIjiEopXFvYRqrQtzaqlAoYDIp1atKhQKoUBhMS/GPRWfEohHhbTrx2HomHQBCMeJWjgojngTl4EF4nrh2Mk50Xy6f1HoQyQrKhAieSIoqsDoWB3T+dJ0rysgpSfY0NoZPTFhLLBfQ2h/xIkYPDkvPUdIxebguiJtIjGChH0nFSkRdvK9ShGCdancTnCsRDoeC8MnzkTjOUxWiJ6VUxYpJYUaVefqnilESy6XVRUWVKZZWLDv3SqgZEdsp1z8UDbbjevLpo8aVwRmTEy5kWVaZdC03ImKsAP5OOhm5UXgxaC2R6PwMDM3ZQlGi0ESxwQlSCBl8GSidgITuzrGLHANAcz6MTkJY8qQB1Aqo/s1EmrDBfJTuEJTWDsH6giOxx7UHMhw7DEsGIzGscUxsB3gJQRXnnpgylJG4HZQxkhwI+lFAioIsOEgHBaZcbMwvGDCDlXBpZb7NKQRDsmQGCxQCYuSlWVdjJkvY/Pv1IEpXM8C5DCGSN9DlMOM3xAhvApEmjDcOUii//vSZCGD+N1+RCMvZPJ6z5hgJMMiYu39Ew09kcHwvmFAxIwYfjNOpC0KvAHMNdvMMhRnnOkGkxkuGrQ4fRdU0m3OG/Z3ZuMI7juJ+rmY4EJR6gbiWm+aSgTly9G81HmMAyDoVL05C2nqwDfYUypFAup0ocKHt6rU7YqSQfuHJkpEYok4uF9COTA4Ip04QWydJMBqkElMtPD50ViUkEknIoU1T88HI4JBecKzZwTT0jHhi2DYRCoyWiZWxkT0TJwUnOBq2TjNIHl6pzxIPTI+k+AYHZVlkkHJ6ViycDibniyI/JZuVC+Vy880cm8RnBodls9ZGtGWFtUjy4wtgDZCxfG7oTBUsqdtv7q5MCIKg8BRrHSMDexoTnVKZ6IBjkBG8xgYeCwMaDmpgxAh4V692OVzN4wcQlETM7Cow2zgjIzOXVEOcNNK6XLKyqx/uZd+WFDJS0DkKXZgR0vRsRcXlouavlT7FwXqxZDqYi9Y6xqXT/pAjC3TD1/KHEEGeBmktnOMjxwwyogEAY+YMOACRjzZQDSLCocMAr1SIMOCT/ddzVNjkOUXMwkwvnGT45B1K8uKlbDqhC3lyLePdDCWlCTlwUjtiUhgEzOVPp9cF+Q4yCQvBbTuMdmVy5LzU84SBhMJYUKPJCELPZFqhvS5RxJnR+ksWkWjl+XKWHkSyYDcdlAjjBtBFZbiIzbRVFI+rFy4+OxJPSMWEiTVxOLRVRlsX84JQeOXoVeOS+sXFI9dQUMoGDSkwIBNPykOF22R9covwm88WoaGic6La5SvLBmJ6xQ4eE6PUZW82KZ6PZ9CpK5uZ3Nk90Muj4JRwaOmChwll4+8uIZRK1y+V+0/u++JKUkrDSiIvOOwjmrbfFzghDMBAs05Sn1CjFiWZagSrV+0s6f8J5j8JwZHleWDh8OaQGhCVJDRT7BQ5ShQir9uZIUMciIKZ1UI9BSMLDnlkZDjkwt0FJDtUgwIfif6/+UQve3gkxdy1k/m4jgnMK+TR8cakZOLtUhpokHgcJfOgQrBR/QFbTCnxA8KThAAA6gZKnVIwoI6C/n4gF4x4u+JBKwmYBnUEoIhF521RHXWxpmZ9HUT1LkmLgP9CBHhdT7EsmD/+9JkHIM4/X9EQ1h4cGpPuIgMI8Qk9f0PDWHpwYK04mAgiDj1T5kIcJkii/M5AVaN6CYSGLbIZKpV6hOJCGclojSOP1TNKveEkUqjR7GwIUhRbnj+GeZmLtiUkxumuagkUAxXyeQouSJYXEgRBlGdCbZz/Y1eX84y8F9dltcDsfOBzoUj0bAMpIpRKpGRnNOCp36lbUiWaviRllcwmhLQkaglLCTqdSy2+qhr+qIVC3KimqLCRrO+nViVcW3qhWqJF7hIij9vdLcFCbIXVwRujyZTLTks7cr244TSbcMDtvlcmBsVaja4akUx0srJO2qKHBcIMFUPF0YKsT8jt89bmHTWrVhoVawywsAiAQAAMTARrWd84X8XO0y3/93PwZP/VSp0R++YjTJgMGZtdKa51+JDUWTeak+rt5bJkyR28umP6Fn0oPnmxll7vk+U8yzvP0zXsakZQ4lpF5GUKwjimULcnNzhySO4Pm/CUvM4ZHNC5ncWMxqBzCYNUgQyiiSARwOFgQs8Hiiq6gocxIYI8IRlvIcFjqDSFdifGK734cJYVvS3jptMfxdaskNQSECYfA7U39YSyMlVLQtaSmNA5lQehORxLCJLcFy+PAlkY0lQzrkdyMLslUNWFwiSfYMc7S/ECXjEUR+JQ8l8uRwjQXBzC6plHCMps7kUq1U7NFTtDW5mQX1GIBoLonYbe0PlwY7jlyXzFU59t6BhVQtTLUikNFfPeMxnUmoF1ZRLwjSVqIasqFUp2zWmjDblHEX3itRiiMM/J2zJouMz+IeZ7rTmcyiQ9GvFpOofHU65hMt4SnODaNjm+ch0zolEG4YLtnWWROKFGt5nK4vCpbClY1TlveohGqGxuqZTJuRD5plykD/a2NlcaMLS12ABhAW6KqW7M7ZoNKFLnunY71QsO56qrO7n1a+0h1sZbnO+rKd2OL5GZXTPLtYzs30ZVZyaM/2qrFVHTLykztumc62crL/qhmS7H3Qs11UpOZX0Bm3Jc1llxWJD4VFT1Yqq3PRAADmNQs2MSVMqfMmMN6mNAOMgKFQxhLRsBhqChiBiZJiRbQ5ake/6xi+CE1ayECE9cwQQCWA2QV8AEQNamzh42d1X8f/70mQjAzkjfsVDWGRwYW/IqBgiHCbd+RENYfHBcBKi4FCMObunYvUu+osixElyUzrNLRTZezF4XHL6GAQRBbSsCc8NRWdXW/zeKZr6SsetbTeJyR9dTATSNUyRD+MMcJSyDFBEd0z06C57T4GkDT70bZfHnyEM7sJAfAIIpkYFU5P3Dj3jyAkGgk8cl07PSndEIkY5n5zuL19yI/rZPLBMPDknXPjpHGhH6yBgqJleWYNEIoEQ5JaR9ZUDi2xcUyhIKc9IsNB8VtuJhAq6TT1UXSa4oRB3g/xJVJJKlU9y+b2u0WExUea4rlNsw04RHh8hGDRPLvvoaqOJI5CYKTyNTAEIiAADkrPM6A0t5kx0gpH9lfnTrI9DXpkee3QXpUIm5JKIJgyAAijK1g5GUxPQvb/Y9CSHXaj0RFVW6EVqNopMhvSc/Sj9pH++muRrhqStxbstlfznBZCI/U76u7A6EqKQCBADhGDXgwShNIPB0I1bE0BEBJQ5oageZw6omDnChzlpZkQprCoBEBUgWdW6bCggJkHBwWcr9PtaqExIstYMFLdoDkkUu0BqciZKXpI4e8ridR6UZgN5UfGeK2r6U2Tqa1LVgIGl7d2tJypUq3MPFiJFrtbo01AUZ1Bkn1UrfyWMCSBjritOARmDKSYs4rtOAuqZcCVQ7L4b1PkBdGG0nSgEqplHWITa5OncNxTakZXyec2o6tm4b0GQ8y3JdD7OLmoj1dl+NJ0oGd68PFcum14fTKsMC3MduigWWtUTMrfFXTep5lWvLKKaaIg7nqhSZkQlctopSPFenDlc2JHy2NhuiuKrNBKKwyIC5kMxzUibYErGLei0PkL9dFoVlHpw/3iHXP5UIhYuXzTctpNjVfwk2RVOelgAMAG6ks11PTyl8JkdylpPqTo0pmXnVImv5K1JsiYwaJb0oKcrSTfj/+7nu9bfmrONa2X17ptejv1+mSWHFGFfybdf7r9/s/837tLYRtQlqxJhrMT2EnWbImf6paC1QAAUXNroKmt8HhnQ4RlsiPU5Ocz0FYAAGm8RBxIdAli8kD0ByQKZqQkGqmXkgmYu8TOlSo+llVGUqG+TFau3Jk7X3kWs0dfdZ0k6//vSZCaDOSZ+xEMvZqBV40iVCCMuJ/X7DQ3h6cl3K+IQYIixmAqmRPcRyHJGgCeEXVg95y4i5FODYXZeKIxgUT5TNhBy0PVcMiaL8vjHI80z8NFCUwxIYuqF/PZVk9qWyCBYFB6aNAGVKVSinQz0cR9BIlpCrcJiAlgPUZaNBGHIfCvdQWx04XjcwH49KrR8PTxKCcTh+MoC0JS4cy2YqhAgUojIdA4WhieQFotHoZFIKjUsHNxBPWHBrDsnJygHDAfFk7JItGZKMLnrojl4/iJvIR+WL8TxodTHbKMHCCJcQcE03XHJOMfUsEgmEJ0sqC8LTU6XvSfuxma8OgAC2NPau5OdqleTwakhfVVIRlD4KzkQvvyI8eSFn1gosnP9FQG15MYw7JrQHB4HQZFIgbI6nbRgHGGwqRMDhQAuKCtKygCCsPSLXUGY4Sjxcfh1kToBUAcgLmCG7ZTJ1ICIAwDmMhZMCmPAYjDwJVDkFZItkUEZTAAkUVoiBal+S1MqjRdVSDnEwUyU30jElIqxRrzRE8VkyEaIs9BI5pWEtoIJWi+QUIkLIJONxbJsLsLWuCKFzQsdxGmRsJQBMCejrM4xBMI5vGSsIQPlHHunTLZRZhGBfogJUZKOIQchNE8uU7FLgfZ2nExF2NCOOc/S5ro+VCXEtrStNxuk5Vx4nQ0MiIYywKJUGghDaYw43i9M5q0+2Y3x/RFpD06pDtgm+PdVHyu0ETvaYJoq0ku1McxvLbMoFpCJicVXC6P2R0V8EXI5IScPeCnVtxM43G96iWQ+TcPMsDYVGxvI87SiEfcUOLssl7N2KwNxdqnat7OI/y5IcSqIW8zT5NsujxQltH7A5b6MBooxicT/TpdWZnhiwBEWAAPvtFyLEUMr9vM8FuwL/VUKVbFY0U7/I3UEQgNSpgvhAVnf/kN7v39pXWUovRjVNU2ZaJoVjo/m6/7MKaH43XZoeiHrxja27NVauiTWkgS/UAOGmfLmzXIHi0SrtIRAB6h5gBIhLG3KCwswKU250DJzJgjZBgVsTLMQKUaMMCMIGFDRkgZchPRA1KwsDCdDEtpmy+hpCG04C5CgVsQ18KJFJ562ro7WBDmeSLo/DKP/+9JkKoEYBH5F209MYmCvmHkYIipiZf8SjT2PwZ41odRRDrmJhN9SSTRGuAni6pSITc4kzR/I3l+Uylwq3RCjAiYIrpFDio8xAnBYtFGwM8dGBuxGolAuoHFVBgcJ4kQrxggelJsohKJkbROj0lwBnCgrMBZEBAiidLIAHPsKy81BpggUgRFyjJUfaQ2FiAtEtpGTkwb5hAWYoIpglEkBhtg6xRqxKPojEzzArQCEuswkKWxRTmw+PkUEJxQkbkwdSJwuuVTD6IkM4MFILLCgCEAGAAFqgebo71kinUi+0Gp9Wn+0rVZHWXdDFm3vO5yHUpyizKfqxk857juqx3kOeCPTli37OzaE4XkjEdm+r7ft6FdMxVxmO/kmWwK/R086/9TBl9dApE/QLXcMjFFLIgyQohPUzQYBFRAXNQPOMZMaGeAypI0hMGiDIoDPhUKwCBW+WqSSCSFKToR9UBinQlUPSkEWtGoS3IWzIaf+iaK88lcXNSOCmPxVn9MVR/taoJavQS0RepJDsSC6OWPDRK5bNNTKfpwDebFQbxzIBHTkzwXH05LCwfBDL9BJZSHZJKwhQH5iOZ6mMIhJO0bCGDctidpuORDYiJrSdDKygX3RlhBbPi4fp12xCcm1YuhYcEpeerRJPoCcczp8er0NKOJkclTB0XXbEONQZ0M7NHRkQ4U7KxDLRuWEEChgM9DYhxrrE+w+mw/WXktOqFR6ohFi+B8pLz4vEYlH3GdS26P5NYE4eSeZlNYgLIfdKpUQ43PBYA5ylIGGR1I57qtFPSxHvmKxEaipKVuC3+hj/q7XoUjFz2edLkZkZmoszy5le1b7oOiubm6j3/zbsdnUPWRoWinSMmNHEksKIW0eUliUSuocmpue/1VNMKruswLdEExA2JdyJTP/qS3bpIjoA0oeZpKwHlGkCZaRG2AHAEoaLwUBQ5mkUDQy6JYBFiSQknxPQIwyCYFiJkTJ6zEuOFQKRmLwhykJNCOtLD7Y4a0ioashKqG3LLexmygXBXPF24oalCiKxkiYaIDMwVfpdLLLIbyVfCY0RBgQGigMkhI8+tB4mFBC0MtJmmSLnyNRMkUggO4hp0cOpoyRAq9zCrSNEv/70mRMgLeuf0ZbL0vwcC/YUBgjKiAh+Rt1t4ABkKWi1oxQAhKMqitCXtNZk0QildpYVtdBbRO2OI1oH2dJqcuk6LjLKpIvo/k3HyUH2oaqOslDFMmnvIjPREhOTndSthkPIijGEJuaEVLayTiRWCpG0u8zBgtiaIwppLNbA+TrvGDrWqjWV7AqagvwkgH7kgY7GYjtOoP1nBlwUdPsQv9RSDndz6xtPKF8EmXsQ9BMT1vzqo56ilP/yEjEdEcJz/PpY2g1x6X/7zzAqf4wj+NuLavoHL4cL0qH2nhtBvDdRU/Ak+ghapj5I0H4En/wzGgVslIJkhuZjQcY4Eg4WMKADBSk1ykMFBBANhAEAAQyAAEjFGVYZFdItYcTA9F5Qk/O8vQxx6ywsyocJHI4U8cZL12IeTs5yxnGaZP37xMG40Mi5QtuZVa1qZmVkB2mzcGIfh4IttYmJcLTEhB+KxsSqmN9IHJEjqByhOJWJ9n1FmfwmJMdcrcR4qlbHhOlOqH2I0FuU7VvbLWsd7Bfua4w8o2WbW+I8dT+Pqej2IzapaeFJAs8034e9ijR4rlDiML6sF+2P30NhpiK5zyOUPLjiNCkZmZro/o/0w0lXo2qvY9LYjtmnLcDLK1WhZltia9rxoWNqV9SZ/NaW7c3XfPZ9IZz0+xCHAAQhn75l8xCNIQis7JX+pCMggAgEFKEDgcAgcFNOxM4gyOdmv06/9p3V+TMRrnY6nfIQh3kIQjVI3ucjZw+D5oEAxKPi4PwodXB8NlgQOLB9JcJ1npV2J8V+HqUu4xAACgAAAAAAACBBUxlAYw6AEydVE5jGMzcZ0z2LkxTDMz1IM/o4wxkdYzPdAydGYwYKgwQDs4HZcy2WYFF8Y8COdO2mKix0Pcda0GhDgyKmQBBrImYYHGngp6PYZTDmJjphCuZaBNdNTSzOQ1BIZROA5YNjgglCMORDMDQRhplZMaqXgIbVjM1HzDQE2lSM/AzAWgwMaGkMy0PAp0GGhlQcFwVNcwkFAwG1NUph5CSoBYCSgSHRIwYzNABTNwYEg5jyEYQTB0YIhEDGZkYqJBcoauxCiNDXAiWAhYZSJmCiT9mMAxgYeVAeKRctKxs//vSZHcADUaFTGZ3YAKbj2m9x7QAHm2bO12cAAmKF2WfjGAAZBFzsGR8b1MeTtLXfIwEMmEhAqDggFQSBAukPDCIydTDF1uSs5jk3FWQoVtwdSKXIcnInA7J6QZBEL01VhSoALblytKayE5mbOp55aKMw1NzlyrTX2n0EUuUm5HGJzCksTsNqGMAQOUiposdYRbSx0kFqtTb1E18IlKr0NR6LU8a3hKpdUmM7dfuGUxelljuH4au2////////6zuPM9sCO+12zQwdKZRS0Edin///////819WOatHRfOxIDA4GAwBAQGA4HAoGA3lnZniXHrQBMCycE6kSxsbyDFCbhfzA3OmA7wWBcNGmRdMZmfomBxFAyMj5oiiibrWk82oOuzjWJHL7souHiaaIy1Q0DYl2Uf89+s8XiaSZIJOj6D9PqqqOmiJix4zWkdO7LVdlP9qtqBJpoWc8sp3OK7/2///1IUGy+706b//0FspaK6jIzSOhz+rVOneR7UAAACvM6g+1Ae+nKaUYpIcxKsAjQNOBGMm3MQ1xR0kmbeQSDARUvElBYSvWzOq5CESmwZaNtxV63dXTXmyqVKDIJXTVrA30JYjGz1/k8HUVAopImuM4Ryc+WwLOp3Sp2VLYmy5CS9TT2AMuWtAqazM2syhd0cjkhkEzRxJuMDSOvuNSikkVPhI7W4jLY/GaeHo1L4nRTERuVu/BM5PVbW6S5VjdmC9RmOT9bGlu2sp2tW+Znb9evTOVR0u5mPUcxnWxnKmctmI1T5YTFWWZ/TUzfw3Jpt9KaWYzdLqv8im6mVFQVKKrhNTN+XcnZZyxmo0AgAAAFQw4O8sCvYESJbV0xaPqmlB4Ikinrcpp6JsLyyK8ut4w60DpKsss7XIkmoC1LKKPOPu3fMnb1/mQYggIggbAJgiLtbNEYkrcda+YjxKlSjopaolpUEyniFqnFx6eUHKqQAAAAyn6IZhZmmnUGGXGlSThkohVXNVY5UDNAA0QQMtQADg4FQEvEsM37WW5CESBxeYDKVK6kDvzTLkBBwAFCFFd4UxgEJBoic8dM6yAlpMiZg3BOZkLOs0TWKo8xBjSYycyn4krULJRlSFQktJdVlqu3/+9JkOYIn22jLuzhkcFftGXcMJfAe/eUlLT03SUAv5GhgiRAxV4tJUBWKu10XZWaw57VBoXAzdILlTlyeMOy01Ur+ujIQOiQvXE4zgMVhwoPXkhKLyHzhJPSGsjaOouZZhXrzmq2JcseaXGzlExiepzAjrTUlkkeLHvHCllYlucRnh6Uzw9cUK4Lmrytx9BPSqnQymcpI1rhm+at0LLK5Ofl0pv3XrzpV5rqDoCwAAErSpgIYBjVjhkRmbN57c6TZqJVd8tRV1WGvMtGPPVafE0NmXZobInQYeTJPFWOW0u52MioiTLme/7/p1YxjPRSs/9qas2aizdKEv0fd+rXmOAwt5oQNEAWDVpm3Rgy4lMNSoBRo4TU0YkxKZfpiDZlACaAQDEQiXpFjxkKgEBUbX0/TB4g2VlqarMS7LNXEWQwZ9y7KlZhjdEdjgbUYAxBHDgFaIyN48TCQKJBijAPJCgvS+PTedI0voKIfwJ43kmPS9CgkWM9DWkdxpQmeyNJ8OYwVMxOnY9N38NSFyRxlKA/jEOZLHFRkUzS8fIc4PqRcq2TDsRsniuISY0J3G1hNbA8b1clmI2cIWJSgmwTPUQz8zq1NwErRPCpM8yo2aXsS2jBocNTpi8VLKjcLNMEtxxGhQrqF6WeYrz3/+s/rJ/f//+a1fw/pS789Bgv4GY1aajsDZOg3MnrMY31EaFrdQpbqVPRF/dWQEKewZWejV+leoCmVjPmHPorMav+mt2mtYzu12ej/y3B18V87elF/G5sEHcrob//qO4rVDYAB5zBg0idBoUhhwYocNGjDCICGGKEqVGMGIAmYt6tgwINH9W500wV/TCQsaVKvZ0mQtBRQayz+LJIvsxJgTF1UlbIblMSUwl6zK6ncJfd2ajRE5HbWq3iqssdqVv3D6A62yl+mIMueZkLAn5cthMXsNxgKQDuOQhCAwWTq59EYFgdj5AHEvlZhU+SYw9LtkqArZQw5ZJUSNp1MCE48wmKi7m4sK8kgKacuhEbkUZjGoETlUlpzTTXYKNvRvUe+2yGcRWw3u9yMaKzVvxJSx9aBM2u9Hq8lnrFVWyrl43jSEaWy1y2mUEi6xJq9XDFGyJLykulhL//70GR7g6fifserTE+QZ69IpiCisB7B+R8NPTHJlTxiwGEPOV3tI4G0wGAADQRQUUfh2aqtYz0d/SvrR5XghrsYEFGdWy4cgp/qNuaGmKVwogKqTxsnwxWQznehim9F/026FK56oYyQjlpq1tCQrqp+q/kbzub4w1TerNAmUV8I/+b9lvDDDSMuGAjNwQE0uD7RWoHAFCUM0jcwJUxKdFQAJCZIZo8XUEoQwHMUPBhEvwte2sRJMeCOPD4licnSqyRjGElTx5iABfmgJ8RgekylGC9SrAWIwCemCaC6VR5qU9E6XlBRI4ek+q37moDCNM4S+p46G9+onqLcGKGlZmNXrJlDkLu2PDlPk/arTm4qJtceH7FBcCgYQCcPhID0mSVUXVg2XJGtIsOihCRI7lQRc9OSRhPwkVRFo4qdxJCXY8DaYqoR6YanGS6xondC0kdsUx0sWKPdKEF04l0JUy4ao09RLTE8aM+mSTm01Z3j3O0q3A02vjKBFEiQbBJOCFyaTbdmWShFEt16UUQqIzfm/tAREf39v5JBsvnon6bkkb2J+jSG6UnMDszWFqZGKZYJDKRVfYhGqZH5fbv85T5GQv6PutGutX9+lKntVPs/q/nVfITvY6DWVSQ0WuTC4ZoiETqRNkw99TQ6h6oACAAEDi4yMJMeTDqPw0rFO1DT0rwwxtAy0bKxgEqNGPiUZC4aRCCc4oDA4kERlaACEkUPEVXS6pnueNLVXiwK71zl9E6i/RatPMpA5KnLNmaIpNwg99mtQh46FgEMPuMBZ1CW9YCwx7Glr6b+BGivK9THXHfl+mTv/CnIfV+4hHLBKLBxlcKHScNIwyVmS2aE0wyMgqgHTYYZGWBSUgKZlgXRqrTx5oGWVgTPtodieqJMKFFlbJ0TAtDZQJSQlQHRR1NTQkRa17siUQm5yFCLdMFYIwzrLK6FzZMuosx0l0Bl5xojSWRCyIgsVXpKTNKKkJZsxBRiJEVKfX2UI7EWMCspE2VOZOTD3KQkgAAAyNtJBQMeQknbTfsNlNduzyoWEaAb9upsdj7p+v02qH/zy0z9EXcJf4Rludnl88yj333ie6dAiNCh+amfXx0tumgHgn+Mk47/+9JkqwpoYH5HQ3hL8mho6PYkwxRhjf0Yrb2TgaK9owBgjYgVW+xc7uokri/3YNw7znMJktvuMm7YtnzR0FPa/6iYAYQGABfFxEwA4ONojIUs1YHNbUjQyURrpmhurAY2EGKhaAJWpPkMFoqXmdFG1RJA6Ox9Jh+FzYwjJ8jdDDO9hH+ChN5cELTq50SsXIv9jKMZSrhEGMylxFAu4g3kUbyPOIfLgjD5Zk+kS8p9jOU8HJzXZtLpbLqrEPO08bRXahay+aetzGTSEtQkyM1LhnAqWkhs7ebHpVEhvSgR4oO8ihXKla46OY6MFqTDzJ5S6XEJp5JqZUh0M7kxQU6lOCzRzmncBdKh0csnz1333rk146LNl/utnyc5K6ZayTyVYxgasODcbMNYfeJxOLkVnjQsCIjPJDUuHZlZriUhpkJxHa9icVGnzdiiZQZr84KMBUw4YBLtRVbUxa9q6r+o6hTsZbNJ/3viVLxR5bnsSkDhnFtyMiPLdL3yrK1q/VlsmX/Ns58i5k//zMuc+W99YaUqnfclp676yBSzmyGREVQjqbeR+wdC//oD/86ZYU/iIPgzWAQ11cdAAdEp8QGumc4IpOaBJqWK3GeaCTzgEDrhwYwRTRNUIX8FS06XbS0a2MMSWOTBDCwiGhGihE+Mk4jIIWwNh+uZ0EbQ4ShvmadiVPJIHeSYlKeQwsJvRTeTw7kOKaiqYj/MpSqo7SZnqTIfqcUJ7tKrOlqolB0qLJLHsPC+ZsPlAxuRzojEM8jJakgcFYQm48w3KqVMNZaG5k0blpOhj3peQHw7t6EejmsQzM1eWjwdWHMWkXhePC/1xIK0fl4+GMBbVLjtjTsRB4bO2h7IFj0eT5MOK9gutlhmFEPEnZoRRgKkpybnAnCeVBlGohHkcFLdiSjLo9DspMhwLZg8dl/1iqAwLA/JhIFxuST95bAWohAKpXLhTSE4fDioUCA1YUKe7UhPbG6Z/6OhfFoiMC2Y3rH/ySFEFiDK2YpsaUahT2KFUlnwSiA+I+TPlI+Z4eJcTf2VvGkK2h0KFy6vk1VClLoyGH1R+qd3Kr//DXZprUvuWgs6LoyGIK3jSrTWhwCKPkADDL9h9w1pZf/70mTGAxjdf0UrL2RgWW9YpQwiyiYB/RANYedBdr7iZGCJeGPrpEQVmAp5nc2ceKxFBltEVlbWKH6JcP0jAbDmVgI2eCqE6KYc4AmUZlCHEHCAkhN1D2BIlAP4tpLnoSgY7Kco9MMgp7I0n4iL1DzoVZGy+HehqFGmpQ4zzL6eRJX0MzTeXKF3VziWAP6EQA3XNtT7ejyAh1A+3IyCcPLoU/Q1DzKV0sItpblhUqpicjKcjcVY7orGRlINqDeWmc1OerpXMheGc9k8YjPCRU7gnjcMAvcQz1oth6I5OF4ajDRp8Rm9JKM7Hy48Y+ifKIo2o5FDqWGfDpFkyil/VijhwTAdKhQMaGKhKlwIMpDqRDCyNKIWYo+yZrslUJEFjfOTenFGzKgnsA7ICw3LpWvFPHbzDSaib2fv1K5XAAMAICQFC6YrcvwrG5/kqCdmS6vCXkt3d/pwiud6qv5LsvilBdQBGbOHHML6E6pUa8ITsjev+CehGBshIPRD6EG9N2ndsIiEbvvQMT1ZWqtXq353XOU/IjvsQj/QWhuAAcIVmpNQWLDIUU84jTwBphxzBU5pwOIL7gI4VBfpXZf8gJKorBGF9oV6L8TEQwCTGoM4chIwvE+I8jwXgiKRHMSRjBVtJDR/D2dFhaDssQY/m4dtzeV5SmELClk+Y6TPUXxP2pPnIrnwi5HDvcVAeI+j9DnG2c50D9NFILxbIEUlZMi/jdyg1KK8K4mMmqLg5IplQa7YXpcT6J0xsxu7LcUB3rpQqouSEE6J0oFGq3FCzgZSHleWw4nFMwlo7rn8Xc+Ecnmo6lExG+hahWi2NStVpzEkLo0ESqI62bbgLUpiXJpgXbkhpyxGQzSfoc3oA5GwxlhVn6Xk+1MySqFxMtcMOUbBXDGqNaQs7HSeP9w2TA+TvcSoOlpbmFHHLOy4Qw8DOioSoFMaqErpnfVVadhnGp1wD3wAAHnTmaIVt6chmf9zJk99O1MtA35n7fI2NJZNEZAJM0zfMBWrNq3NMshvM2ftvEyVoJcHlisyOCAwTdH2taRC3oW+h2wbyM1KKX+6Nd61RtVJzsoKYKMx4CLUaAPrg1aAS8a45oMkpZEsCzjIQBax//vSZNSDObR+xCt5ePJa7vjIDCK+JbX7Eozh6Il7PGLgEIq4ikBYh91YjsVEAABAWWUOEEEKg8kKMAfiiDjRppngjiRBaycF/c2cV8jYt5TEzbCZoQfAxy4qxOIst66LaTQmcEt5NnR8q4t4pYgBpqGQb5cSUsRbFMfytWVgnqWXbCq2U7k0l24dStUR0IQcCmUssY6EEbqDZjuOh2TNImm3GahpwlxWk21F1Q1VI1CFl4pGs4EKSiGIQpUKH/EfRXJ4ccZFligOSHsKkO2qHmfGbYKbNPrgvCPYF9TIcdzm+ZHJQRTQzAYmHEUp3plKCEyHrFTqrenwpJYK+yJFWLZwPD0jEqSyJPgt8z47lk60T1JGN56vu2tCkWolo5opf0SvrR+OCGl9JarMHO8kP1UMTo/8naxOcNUIJ1BGGZt3OkcE/M8huGO+LAMiHnyHRCKzpdQEW2JzRmgwyCWXI83IlhzeE3kbNxSphSEzJZrdVa6MaOtTpvZj39l6OW8ypLmdkRQzoYuyHTBkUGYilFNTTV24soC2TgCGUAAjTkBQAEijU+pqQxt2D1JalHRQoCMRiNCRwK8gKMuosEhCpQ+TWkh46yWZALCDL6nAqQlIYJ5GE1gyDpEZLoN4rz9T6EKAmxjHWl36oJQ2kMUaOTjjqEWQyyXM8YVpEEhFpenEnyVF+Pl4j0oX1nJYzkFX2xDEQyk2VmELGEd0yLVBs6H6YBd4JI1A1RDTgEMZVYYBeDrZVEaekaXx2iIz9SHKbilLe0n+r46hYBzPScHupSCq5QJxigHapkMHOYywpbVa2AwmQviIZDmU6cVqlNdyVreW4/DuYT+nJ+WM6hx6RisO5GNhWr5OqmQeDk8XLyAlqlhOtVIxzRiwf5yE9O9VJVuNGOdDxUOaZTaudJ07kgwM8JYU6mWy3t6JgmC5IxU1MxqkbmqbQBJgQAFS32s3bU3uuzEapciIS3dnBVW+hetSrfmj0NP9waEb9zNmN1YhWBau8ZCo7EcjEOcsUc7wo1S3/41Sl4hP8eGhV6I4gpDhscAeEbzhw6bRMKcrURkyKzIRUzXljuRIpdDwOZaAj0AjoDJYwoURjIOLzgwGIUogQWv/+9Jk1YMZc39EQ1h5YGfvWIQIQ75nqf8PDWHnwYy+4eRgiPiAKQ0Y/8kEwAvCIgpophN2DCJxsgTBVYXLa47yuUFmZDRWpLtcNJQtaHOTQMUFkT42wY4VxbkAxmaQoeIPOKORPE7ijFBNl9L4sDlP4KMlQ6FREJeM1pPMdBgjwEOYEYdxbisKdDzIhDnLQ/VQpC8C3nepC2uKgRZLUkK8uFeaIwzJL8dDIPSd55qRfFvLGZmS9kqLurHp0syLYyfIwRuKtkkNtJockDrRbE1qk9junVieisCsLcp1CwkFQpeLEhsTSFISc7WiR8nUnSeQjgV11GLe0ow/2A64zEikOMN+f7WrEyhyDOBLiOIQU9RGDPdqJ8ZchNTWOJqflvRaiHMhKghmou2JbRDOrkkYxnKqZD3RjxTjOmh8ExOtD0yyJRUS2aESkFy5TbAQCCAB71UNlobtWM8ZFhAo814IrhmHl9XDk3c7gnopOS6iHombI2Dafqm269FRNCK+6L6Fa06Kb+R9R/TI3kXqejNlmgjFK3R1RZz2oVupSsbEt0VyH5kxOfQGBlLH2RcxmEUSzgIAA7QxYMzQcGowMmESgFdVhAnqNgdRtzwgqBAUwWNGpv2sUB7C+LgnkWcjAYINkzlOS8XV44H4KEW47UiOVjQrKhPZqfi4kgZzkOtpJkPXOuRWKc7DpM67KZxvGAn1GpF0hjGL8izpQwoi8kiFqQY3hYAzDWUgpLIZDSl3KCqjGOQ5TzO1LvTqVJpXPs00gymQvQEMXLgqZFTFqWa5L+aDI2uSaWGVyOdCjlXDC2lzTq5hrlqZFErS2sbMmEPZuyVWjnUZiJ9JYR0W51RGhjSSy6VJkq1QqB/Y41RPMlkaZ6q1CgqlQpJUadJtyVR/IT0chCrP9M9uqyKUwEOSDhFRKDZ12hTFuKhZeE7EYT/hNdlmZ0uttZ/IyBZQv2KpnqtvdgIABVZkI5mk2lf3fRN63P0byDRYjVCb7n13+rwKpKcMUDkVBPGLo7mIvu/x3q+khn8c/rnOR1eRok1X/B852oyn7t0pyJR9EweQif7Ef5CZp0B0LtV6PU9l0ZXo4qc4bh9xRgMG6HtmOMeNI0M0Qf/70mTKATknf0TDWHmwYS7YlRRi1qWp+RcNYZPJdBVjFDCNO6SAHoUHGAOJAiAKAhGQ8yC4kwggMCmJCoqINjARCxPBWORF7FSoJWXxwoYjml4uGB5qaToSBYfEECTJlNASdMRXD+uWk2jepe5UPtMZGxh4VThgx0Jd8vGjhBzTlgVnohtnTuRPUOS9RMTDWg3RUJKIaApVCFToPCxVXQM9rHF1tbbgvV+oVMM+WQ3zIYs1xkH3XrUvVgutMiWT/3azhwuFk9kmnhPVlO6MFDQQFA8MFMViQpqqLlTxWhCCsLWmCwfy3AVC8SHAfwhn5AMo1A/RHhTSEQxPgaH6ZeJONRGaM4LR3GMbFpCaLR0X1glkx/j08DslDdniSdpEi0twK1TRwXyufIMa/S5dhfi8tMIR2QV3RL2bJaISEZnyU+cAUgCmJEJSbgWS8BYkMZ50W6mCHpnM0hR8PcpMyfhL6KZ2pWCylJNUwIrT2OB/x3+C75F6mbiOUO/DGT7qfrni5lv47vqTSfIti5/fHo8cv/363QJgRV773Od/8oD51bCnKwAMUjGOwVuABoGqAIkM0NLuiIkY0KAooCPjIsvGFwRhBiD6Rzi8ctONfz5U8wmi6oky0NFSHeZKHj5J4Q1dHCmgjodJRg/SXm6X1InKXk0GETkMBbMY0HocZoIaPEessRehXgWy2yF+GMlSpeu1g9kKRS8cB6GmXMtsUkJeTAQxVE2OhKHUxx26M2J8scRRKaPRxWLx1OyVg7fOjijBCB/Lk1ge68JpUgiSHIDA3cljBVjmRQWql2y1mGDppthEgSH0ZCckYSJqRTRPIyygMoWSaExCvGUC5qpPMpfGLc+IkVFUFfBBFnCqewmem51Ujp3OxuEWHwuDeMd82W5gAtQAAevhtahqi7ucOzj0W/dypJkRXMpSYyNCfLrobTJrSIiKu1Qz7SZAqHCxMudaHBYqpmGse8UPNaiJ8mKH5G/aRyglauHCFWfyCn3iwDChNofBSAyKHH2iWRAo6pAyMkgA9qDXJuTg6TIXpjABiAgEJhRYACxjqHpDCr2FWFwkWhrKir/A4bchCgSEFjqsU0EAlqoAEoiILM0Jx7I0tWwV//vSZNGDOAN+x6NPTPBe5ajUDCM2Jmn7Fo1h6cHtveJAUw3xEra1gtwOARYL6NaBBBDTPL4FYLtGIgXUFST8bwCkDqVJEgOQVZJAkYVoSESAM8XUhRdUNJgY55A/BZBIVKtnkTFXGucR+F2JCXEvRjjlTpqqlJqMoTXToxSwFGoiuP9Qq9CjMWWVWm81nsSko2hSJC1KywS4pczkYhyKttB89VK/R0QsDI6OdWsiZSNU6xOaoS6LZzlN2NaO3siFKqCc5nJ5ahLtDmV+yOSqR8qcsxM6HNcNZq16Z0cc0JSpNvfqczDyRLXlMnO1qNifvK1wzTLDGeLI6VrH4MRjhyVanBzfNUSLJGdvEZBcH8Jio4QB5QMNGpWr16DYt1/eGR6YVekTKHq7PN6gkpaKRyeOX4Ivtl4kfIwWGsxkcK4gjXKQncddtEtig8LM5Mv8domHCqn93fFRpl0o597f2P88qnun/XIvhiz8jYvk8byBN/I5dFGYbDoJWUwbnFgdbdl0LYQCDhhB5gyYKYNiV78AADYDCzwZIat5otgVMjyOJMFJJjigSKICMHgEP1KFfl31al0uTFphSmGHqlEVAQ0Dw6mSii9beV4jE2aqVO6w5TFOFpMTgxiTPIXE3qg+9LmmzM3GV8SMu6pcnWnw0+Kqln3IgdyoqsO9S2GDMwbK4j9AFSBmHQCR4LZOPWCTxOHtTGZXHk5DM0DQa5xTVbS6AhuET6nCMjOnzKM6hLTKC+PBvdu7FUt+P154TV9USpaYHmHq4tp4kJxeVFC6yNt0jvVM21SX3U6eIhJJOEdOU0OkZscrnXzPddMrWqbUQDRYlgHpzJKsGBGtGgtPSiZCSzTjGLc9MKUTvXRirNkaAiwAACmAxtq0zXbPu0RIKcGYY+02sDQl0Ntd6hrSgOUKSXC+CDAidg5e3lDjUeifW7C7m/5b3LYnGzVb/+sif//39/+891/g1+b/tVt7mceROf+uT0BMPCnaHd8QFdkQvkQXNpNSESIBlAJgXJvHgJomsSGJeDBoMbh4mRH5KaZXVlqR4YIBLCKw1BNV9DTSK4XM3xwnGQkLEWlxU45nZnjpNtNhEkuOAIkL56S8XqEJM3T/+9Jk2oM4D35HQyw3wmSlCMgIIw5j+fkUjWHoSfe+4cBTDmmkWTQZjyLyjiTI4fBvNq8PUS8hMhMEWZZKi/J1kSaeOotUwYTo4nBIG+W5VNUQzFuRmbz3gtxpqd2cJipg4inesSJhuz2VyqXFjRgRXs6fWUGoGhFSyOLtcphcKIneWs4E0uU1BXaNYkk8nhuSlTy5OpjeK2iLMeP06pGZOoQ/nhoenOhLSQnKHsch9KlnSchyGEZDJMizIjKZYSBjptWI9C9n6/P3Darlm706VITM/pYsqUzFVh0wobbFRjBNA0jWCFHzZSMTOmnTbY6KyWbIQpwtlQWdRyaPU+RjaJVP0HnDk+iRlG5xKXN57z2v61WHIqje9alKJjpEqZePAJm8PHfv2kJOOxoAaGxEZ80CAo///gxmPy//sckJLQc5Kyjq1ZjOvHmzBSEAujooJxdfIT5yGxnFxJoRXEiQ/S1TASRrVozf0kkEhwpiTXUK09W1BJAAMmnOBANEFNdDCisxpsDGzFEAoMHi5jSZmQ5ixI8HL7sNZ4MkQWAagBsLmegzzC7eWI5SiEPEwFlDkDlHQSGpngxixB1jDL8T8XAfioU6lO8toi5pHWNQeSvH0wsCgJsX5ZNMydFvRx8M0Y8T9LnOm06Sk60cyqAlp3sBgpw60IWS4sp92Xh+qRzV5YXhzpJCHFCDsKJrQ9ZhK1Mo9aUE6EIWb5LydVjJRUHzdTrVyMrCgjmhdK3UaKgKQvKjdKG7iqY6lQpigqXLYgELLDRCFCu3sAxENhKOASQ5DfNJKKo411DME0GiEPlWKFqkNU9DpOtBNx+RR0rtTrQ6USxIJKuB4OSjfrRdzgbGw8iwJ7LlU7VCaLiwQFK8XmA51O4OcGOrGXbY+cE4oFKjWKcAIAF5jYrUBAgMWXFZOjf0iCDnFw+c9quvurGteMORE1U6xxxMRMUiORC5WRlUTOc4YqfILraQhGYYgk8p6HGsZzDTI4u52f/VatT9jC9Cu7jYsn/8RN1XBTMKvzjNBV+gw35jdRh/8VVlQf/6COUPH8NkAAYgAIBAEgAEhMxtyGBZNmtMMmNCHHMk9mS4TEBDm1ZdmUQ0GbGfGPSrmP/70mToAAmQf0TFaeAAcm84daSUALQyKS253YACQ0LkXzCgAJhDkgSmuhZGKIdmHhcmzw6mB4JhASnMNhphwZwZjIYLHqGZrA8ZuKgAiMqGTMR40MBQGGHFoCeQEQAZAVTXeIhcsF5ggGZGKgQGC4Kj8YQimGADAXvLbgEDA0YJLgqTBgqZcCCEACwKDAVQUtEkmXEcSqYYAOqYMCGAhoICyUbJC9F8IGi8Q0TmACabiu3XDA9WxoEHy1+xwSMvHjHRcs2MiBKUhw0ShSLIcCmECqPQKAi71103HLeQi9UZwywWCQMOgkHMKBzHBAvCAQogCgEAp0rnQjWwmMlU/TEoNWou9+2mM4dOo6DkJhtzEQ616H1WpToGWyIGghNROZJtXUAQtuzdo1MJjPZGL8Tfejd2C420uH4VSTdO6ksEAEuVuCuAECsqFAB9UJaexcn2mJ6sTfNR5kUDwwsmTMGl0Sbq3VyZLcws87jT58+39j+Xe////////3p2rHJXYl8p+pKN8r03f///////61bv/dpct652rvGyBBAAIAwCAgCA3cCnWgctppLDhD1qDmkjVo0ruWIZVDN4AMCwMXIB4Y8asqiwPJjXGKuIguRtU9ScjKGOSkQjjiMOsLhoVFZxXEGea5MNSMuIxOYYSl2a5wrnFWRxADhvPmF2ds4oYd5hG4mT3zdFa2eej6PVknon6frT0+Y1v60O/7V//Mf//P+YW93//zvKogCEAAAABUHwhvRRo9xgVB0eRqyBlVhySRnoRhFJQ9CHYCcigoxR1RcRhgEzDZzo9NNUbqXIOAEFkPoJQSBAYFCgwdAealMnWAFgoSA81oLnJNKgOyC657sMDARmPNaViUZSGQCI5oAYdFgvVIZG+CIRYIHCgZKF0n1iTjuCvhdNK6E7Or1UQhtwbKXi7Wct+qiwFet1hkTfWVPuwhpbiAQLVE7WSNjUrVgkLtdaTOSR97cvhqavyh6aSH4NiUah6V34Pl1m3GO0MPWat69AcxhZos6kOzEQmtR6SxjGVRCLWaS9EZx9YzfmJbM26R0KSNwDHM3obm+r8RWpL4vOWnOcuJRqOxl2L0ssSmil0ByR4nqikw6Fr+H///vSZIyCKNlpSddrAABl50jx5KwApNXvIS3h8clAviRokYk4/8gAQHExYiJmjRpiDu5im9oslJpOJI/EUhicXD4SylwgSQTysBgxJREGongg92oQ//5Gzcab/hxKW0Tx+//5IThwJStf///uuESorpM1qUj1nZYbB0R1nhJS7/pSH/+e5d3T4v///hgNIAAGNXlDJ1c1hXBgGYIMmdF5gK4YURGHGpjJAYGQGOhZgQWYqJgIJMUAwCGAobGQ8ssJG44FFggPkHSYEHBchS8vQQmS7HRA1htEWnLEgTAxwXWo+dWIJxexh0JNAwXtLur7FRKOu6updYoVroaVkzQEZmKx55DKaAwddLKyk03KTKbCjIAaE11y2dpGwhV7btMKxUpelIRqIQt1V9vhFnRaVTIaEOil0LgQsICchzjxDRI41FakCAM58KKrA+cR+qqOrI8FF925x2meCxRW5z8CyFYhKN8cy6Y47DIfcske6IcHqLZXak1Np+u7KGRuKs3Z1fiDGjJ1CXM/nVGOkFtVT1DT/XCBaz/T0CrxufIZ75//v+8n//p/1/X///xTX///8N0g4ACAqMYaXrU5MXItS1P653OgMErqQoQexrG6VXehPlf0IValCfQnyhm//tfVSqSsyeQVybFlYv/rn/whhjf+ffxH32J9GvI3qf//////4doHAFgAG0kmbLmLjGAZHXnGqTBxwxZE34oSPmCLBC80jMwwMWDIZAUkHPhkwZ88YsgjiaEk74GNAEQ3NFpMUKiGSjIJBssiJDFzF9gwEh+YIKkk4png4YAAU5n4tkHeddVZ5i7KJIBo4YMiAgoiFtkz3oYSu1FJH1VzZE4yYRVEienmdwDSiICYKXKExStJ5rqE1EkCoLhJ2K5Zapg4LRwAlmyA1ri1UwWcLtSMjo8dTRXUhWcocpmu5szZWouM70gvvm4ThzUN0OTAIbaDNX+Sqcpbbgvy5WUViESjXzUSOEQHozD2hNAHTa4SRD1lCgpFl2yAMoYoTzZgV4LmYsOVcSJkY7god24kFpWfMIqCdkB9phmMF26EM1ziyAplKzbiLf+lBfxaREu+5/+4EkFDdoEAqAAAAEt2jTNup2NxXkf/+9JkoIMpiX3Go1hOUFvFuRwMY7AkZfsZDWGTyaG946BhiyFWMv81q4QhZhHWC3VVSkT12EjIVeHBJBqFMOQk25TIdYIU0ogGxzhEESJseWUepMkT7Btc++EbVM2V/2rSlEqSelaLXF2/sK/WHDvWFSABiZx4j5pQQkvNiuMcSEJkIBkTlUQ0VEBsrBiAItESCvyiqFw8BMhUuRoeuTKYoKBxAhoIKHLVjT6QVLAyY5eBiisCI7A0gUN06hDKhWSWmbZWZ/4QsClWNCLItNYzDriSJmSwVRFJIdBW6oev5gCqa9kYVDVDHLYMW5VTVSdhmaacRSZZFMQMzpOiSOPccFDFa8ZehnjjqWpmuRDcDPE9b3u5IoehzCQTmb+xUpkexdKxhREiUPnyoDvxEtEO6vHj9QUzh9QyuWL3iSZEpoGr8b9DBsvNIa0OCyPqqPLuWUpmHh/k5NoDLRy8unXMwkhJFCm5OfNJl58d0RJ0RecVGxUiTMHXNnTO3Jktn7Suji0qsOlw2RR7RMkjTuF6A3hUAAYAESPSBEOWTV+/z6zFlrS9755cEEJurw3DYWghsdiAmJ01WgnCnArVgXQyiAmag06SjLWDdekQj4cQzK08/LPkNRe9rf39Xf6oVFL/za+1Pletf/bon8jNDuz6Dv/udysg6EofCUt1wgARFBqEIBMsoAz43jvW+PlcI8JPgG5DUaFMdnE2omDKgsMhFQ7GDw4PDQ3kjeYNyQIrNNEyRUu0bVFlgRwAKBlvlQBDrsFBDJBgMMYMxAIJe9cpEIYAQKYBxBAAngEDLmjBQjgGIhIPh8fximKG2PSMkfqDBjpA8w4haj7Q9VxgwwBQQg7ByMhYDIHIlm4QswQdYGuSccZiKM0UmrWMuZznmZ4f4eCAHUzkEFcjshon8hBobeGke7GwlsR6nMuOwIgvpxp5SMZK0QrCZHNpEpyrQdhfi9w1ajcuC2dSlgOk9Ie6rN2RIqFahMSvY4aGLKebFGeVnN9GS56qpcHYuEM6fWFS6XVFSl/pnNNV+acyoEaCzKlUJV9e8d1bGtdXa+ZYraq/29uj78/zFr8tM8N/dOERBdAAAFOyxBATVjWMX+ESlO7fkP/70mSkAAmqesdLmXriT6u5JyAlhiep9xou5TPI74fltDCNIDJM8OZGSao7du3+bovSb/TbVTXbLbaqM5vdPpT5f7ff//uhfRJqiyKoXLvUSfhuQFXXYjvVKPwcuyqnKCYDmR4qmFKiGT4sHO6TG9jzmBjyn5VjmYAWmszOmGCOmD5NGJQnmK4wAEADB8AzCwITCsRB4KzCYRzC4FTBoGTBIFS5pggCqcq4AqOabSmacyxgC0TVGOkdcQYcbz4sgj2mKhgZ5xliA5oApGUCYQpcEvCpwghXS0FPFniGzO1dLqfuB1F0aaFpyn3+WAQueZfziL3BALcG2qMrdZ7lpP2rCqBijc1g35TRLUhcZEYZALXNak8udmH2+p1FGHP8rqHpXDlW1XgSmnm5UlBIZwE25gMCxIA1A6GEyMII5m2Wnj5IOxFK4GSRYeBIREBGw9N5MJUQhJkaYZmQBRxEPt6InIicWEzZlEYJfMiGBg8UsHYRCguQi4ueI1yQ62XaTFzjaES6blnVc6cHMF/ZTKQEMOvuVY1IwJTu4m0ts4AAAMTATJcmMNRQWkWDKXvIqc2wcQo869nGihvp33dTXfZ2ZXcliUfT1dOYu94s4BurFLFQ7Mpo/937qz3qwyvyMCojLH0YQDFCw0OaMtADICc1cUM2JzKiYWYzFABMZjgCAX2FggwkAQC2BU4gI2yZA1ZK2QErDT5S0mACmmhrUBAxC5WBYRLlFAdArxJxLQSNDiYLA0xEMXWaM+rT2kMRp1kromWCS5qaILZIkrtNV3HomlNVAWFu+qJ1EwUfwcpPpWJbLEmbs4EhQyu7FPRmSnS12KqYm4pjbK14IKzE+fuykOY6S6sEMlpuu1KjUeS5FKFLluISulk/ENRbO/LimVhPwFBtOF7QtFQU4dKPUR4nolWjLGQqEuEm5RkarxiylsWGZrXR0GioFMsFamn6eVCuW2JDzvSTIhxyxXrcsniimVTmmimxWlKmUWbYxYLU/WGc2jzO+Oji/oY2RkKORRQVds+XE0UpAOovsh1IYc5/pTLOm3jRaZsaDsZESjW6cBBDiGDCWhMFHQjb4caz+Gccq6rM1L5skgDIrOZWCcTVh0U6//vQZLUDCjR/RAN4fHBbzTjlDCLOZu39EQ1h7cF8M6OgMIn5G2IVhVkRmM6Urmf7/nYWv6nuSGdtySHkpfIrfldRIjEN8C/m1MVDAop5XJpgM5gqVYK+SW/ln9xQKgAFHjtFRiCMCgWsMkeO0vMESKNxm0ZpDRc8aAGMVsMMpE4UeFARkyjReYmW4iPjervS3VCo6/Dc2Vhs3GUpaEXiLgpKihVEnSd1ijQFDwxLHB0C5VdJfOyoi3F9E0W3tpXzr9Oc5MsjJzBFOQjwzScE8RITxNh2EHSAxj6Lbs/zzQmpxECUihMJmZycIamTSUZ2tBM1GplEhItJBUuosogxYmTpR5ey8MsBXrybYzruXOZQLavSt0KKJ8jrqZIq9YReDf1AQteN1ea5lsz1QW27eqF2u2pSKdRHeklA190p2U+GIwXJhSbQcDMT04lehR4GlDdpFVoVKcJnrbUk4y5bWeEiTnM0lbUj1FHUCynm4tiDJopkkX1+rn9Vaxoca6qRp9omqcutMaTRRwQnilOByPN9FhhCIIIhjUu2FSyLb9IS5+v36c3xXM5n2tlElMcXuneACGY50dE6bc62v3VRdUPdUqSRlBEIrtufRLSoRiaz2aRr3dn2O5CT+f3R0Z1UMfjrFfAb9XaB7Kq1IyN+n+jP2pGtAAAz4KNQIzBD044RMqLAMiGSBAMCRIbAokYmOjgag8r0wgJkYQBBYFdxarbOakJXYpF2wJwphqSZw35bZzmaq7VMvnULUNlUFDADFGcoDxVMcxjULqPEV1xRZ5FgGcqC/tSAUpYCRE8YCfp4YZIxQHsi0GquhSWXKGPmZSrpVsDGvolUMrWmtnEgvqh7YSRLTwrnJokTVZI5NPh9K1rlU6Ky9SPYfsPJSsRlqt9ALaBE4I1F4tKA4niZOPqFJqhOuGDBqPKxImNF5JPVzLTKUj1bbYToBOOiUXVZeRnmnQ/k9lKOipShnqGOScrjlE+TUqY7L5fsXEipttWUisPJiUjeEyfOSwSUM1QkIpnqehuJS15bAvWmCgtkQfU2NKOWVJOBVpJxzq0r1kuu6op7vt/duv9n2t//9GYok5Cx9gxpbCWB9MsFwyBBMsjk2v/70mSoAwj5f0TDb2XAc0xpPQkj8iWl/xCN5ePBszOltFYPlDgu2ybYnmVbUp+cHqqO252h01F0yYRQyUm9Elc642LKUc1V1MYEkWsbgt1JoiGbriRVS44GDZkNi6JVJ/sXsiMvRWEAFCADHYUypXAC+aMkmDyf4YWvPdI3H30IqQHKDGjMBMZsKhLABQAygGTI0NJV4kwjdAIdA1TSF2GCDqDhJWPQJuAbhYLmOhiBI2hh1HSc6FDVRpvk+NtBCPBDFEJ6cCVOlHk8JQcyRVhYUKPAbx1jWHpWkksE9RSKUDjlFQkKTKovGckYpHEyGI6EORqwfjxfKk0XiccozIaasQrapX2o88n5HX1yyqVwiRGq6lTrOcCy72qWtMnQsqZ4hrx9lcsD14wIcaMFc2dLp+3K1zVygUqLkVbWtOB+HGhNGVaQ5D2o/2ulTpgzqFP87zteqFaesLyOqFYndvHNWuCkbVwwqVDFI9TsU9lWrGFqNFPuoCTX0gfsd4hqucy9JxjV7CizsLfBV53xm1D3lI+51VLb5ohUQAJCQeAtqJu+z9GK969Gzff/6f/8/KJUiYHjoGAvDo6fy012Yc562MsHvuc3z/wsZeH1lpcxuDeWoAAlclUweIPp7ZNDpCAVaxI8FiaHf79Jki5HGltM3Mr362X0n0G2oZy+7/1DKhbrgAA4CwCgf4IEJOAsDAmMqTeGIKPbixRUBMURSpe4kYGKFoFioXyEuyrQvx6UjHJtKpD2EKeplaNtOlYkTlX1eSE9WUGQhEpEH7JAV3HYfZVl8TwNDyrEqkI6G52dvoLaZIgLxIOUvGqI0UJTmKVnJltB3MUbxfRKTo2HgqPEiKi1u5Ya5/4S7CeONF5Ik1Qg4iODWjOnqw3gueD0XHHON/8qiPWikqPOyrUlJefmMrkA8OFxniWtSqQEJw+WmxoE/nS9m50G3IThxDVWiPFaGoMUzhZLJqfF0Ty6uOFGFlAYVJl5iW2TFITFp4kLiksWiK6xK8V5KLuJmWEqHH5EaoiqkAI642kczMPMKmMlnScivKgScKEP/slasf+2up1dch/vvtKE7QGmDnXOIZLFWEEmSZAaYRD9RKe1NBW2b8fZ//vSZKGDB/9/RUMvZDCHrSk/FSbiI4n5Ewyx/sm7sOOwYKG4V0nk0ZgGhXMTbAILUhtn6z7hE41DNesrshju33mKUvNdHCz+r7G4Y1o5XN0xml0ubnRYShUZccn01xM4m1gtTItkzmFHWfUMfoHcmTsQoAcYUKMyJGYywwEoMAJdgw0BKlnS+oWLQ5IXNrDqLaxGvsmgSo71x/FVGrQlPmKPOmcytgcgTpd6iZ9OuYx6KPE158GltPpJx118T0aaoxl2mXzbfP/KJa4T6MBl0qjVO40NXX4lkEJVsaQSwzUCQWqUPzw7KxkYktsjFqxgJwtoXCLAiCg2Py6Dw8oDiommbsLapppUyrQDM7Ljbg8OIBqR2S3U+WmZkicRqbE+pqJKcwDzy+UjM8HkSlyItM6CbkirzIS7IyolNOcdJp9Pn5JNGXkNUSvnJCqkfGTSkyhi6P6IssKqkgqQ/+ShfQpJJeWKrzTSkJXG8rWB0/TCheIS6ULAQZdrg8WRXRIM8aKsTQAgC8SygkAM9qx8+7OB0yEzLrKuvM//P/r/n+KuHlZg4HA/UUssQSyYNEWRKEIXJO4s34a+GaG671hylklpJNSZkeHY9lU75SNlWYFkf/1itaX1JvmTV4vX5q567zcSiEkGiJ8m2OrljV4B0TAlvJUZ7kAAOEPEKAyQdYQ0ItK0QAwEyNqaLQDRcwwYuwVTLSC8LAxIKUKPCRoWZCkLVQPkgMzZOXJ+hCdL4N4lynQs7iZLvChRx+OmbMQ7nzEczSzulQrVw1sq7J6IHlK9vHChytgnGrZVGZRxqMXJlwj1LYoUk8kuiMpTjk6IYiEZWFTSotGTBqKhzqPx4Szo6RkskGiGZBItDobnrBuR4XqmQmiZQsDQZmER4eNgmNz5SIBmOY+kc6LKE3xHEUxIYqaKRZLNnSyPg/uKhasMBipPxxZOSCjiHIK0pIqJRNHMmIlhkYwA6cnUgmVRKQ1TppJ4DVwqk5KuH84EltZhAJSCauGI/IRmXwaLETtEhcNUJDEJa3w7FVVUE1QEAYxhNObDh17PLiwGZP4+vL9VmXtFStREQyPZyQ4mCMmyCjzbb2sXedNqtFEuT/kFacMS1Y3/+9JkqANYvn9FQ09j8GGOmMgEQ+Qjzf0UjWHhgZ224pQwjLFqwU5FsXqaGh2kRb5IZtl7plWef3YvKqv1K9L/NvUyhkXUfKj9uJYNh8IuKQgHKPDw8RsOGVikCxBE4REkHBr1ACZnSYkCPihoPQEgUcEmIsqfPULUlzTQIgBZjnEpCQRxG+XtD0WMeEdBDy4n4X41HJXyuC7Y0aaSwfKnLug189E0Tc/jibUwqEwokXGUqZQlLbRhguL1SQztgrOGxJelU2/UW1y1Rm5aZ4iXWUKQ0pWtQtbIoGNlQ1pVqFx5qKdYXJ1tZbH6sZk4zqlRHOyodt+wHCysbOpFSrENZ0EswVpQLbQfiHJJ1BwxnMrzjPwviKcaRi5MLCyqpWPD0aTdVSEHTCXSGKGZMP1OZMEsJ+qd+l2o2DmSUBkwrqMimY9MqYP94/Lmsr8Ev7UtyNythqdGPkoaMZGqRgZYj93AeNylcVSjGqahABZtotAObLvjewavau75WMiZ/f5/odunczzjiwY8Zx3Lab8ObCOehF4QALLOf2S/f49gI8oT3yynlk2R/TqueiptM5TiEXYVI7SL+tm1IqhKEQzw6qRnbYZZCzM3D55qZobZSf6dlCERKWQb+IgoDDFKzfhMNcIRWu5YKEMOciPMJYz0FVVMAcgrS5j2uC8syyNUU2ScyCwmOhhhAFgOQLAqHZqGQ4DAe1JmtC5wUkfhkPTfOYrDncygHoHgOQIYGQXYXMesk8hCJQ1Yh5jBfk7V4ywMZNw1BEmmas5hiTmW5FwFwy3nOMdCzvUBkIRokA9ARwpdqBQH+Y7x29gOCUYX8JkQs7H4hkdKWFD6qqwlh8Y2MGTFhk1JBdKZRHw2JzqFYZKblhfpqoufI9OD98yStIZ8qgXIDcSmJgik4lsI1ZOsniVKSYzo9XjkuA2Jpmhj+vocnA/RA1OScvhOqLyouNh9QqEdWZ9Y8OEyc8smfr9kq+I1MVi9xxRdK8QgoAADsM/Sv3SKdLtLpyHMvqe0567mn9++vH0p+IKU7VIDgSvb7a9mHKz2zV9W64QHuZ28MY55+3RbnReDHQPSbS9fdYhyF7ykRuf+ne0j9IZZTS5EaPsbCP/70mS4gAi7fsYjL2Twb8wYyAzD8mip9R2NZZXJeB9krDCluEl9/RYsVLcoG/szQOIdMzOu9GadhS2rA0UyRRgA0w4mOkOY5HsykI8KwIZFQkcQ2YpmDUICHGCOBUiLDjDgC9ZZQIjIqJbAI0PDAAEAwtRMQAELnFBRYGiwy5eZpsxAlDQ7mWQVpB14k4F6VXIpjABhSF+DICDM2KvM1ASCZ+XkXCpUFwVCxUAcDLOFzCQYBMGM4kKCUUSAIOZpJphgPAdHDJwUq2IhUDlyhgOgMIVuatoCoBUSRAdu4QQKYbZcpBA15mAKCZS3BE12H2HAyoCtosggq4LsPo7r3w+wqBWZlt2hRN9YBEg4SvC2z91mrulL6b4Cp5++6zuSyxKZig7JhgJC1hDK8R2XBxLyl8pkxaWEg4mZpGtlBKrLTjNdWoJorJq+yOJZDGWk5lbG6rlm6VmGEM5OrriBEnc36vyl8+dVWtLb0rjyJE84/p86sPJfXGKZRA2vcfCBETRbKJDgXcr0+7M/O5VPvxzOnP5cYxzZnQgEAB5O055CaNSlBSJ3HROghiWuSQMIP2W6jpA9VB/BtN/hdKS6ierkR5FYG1peOUTPqc2uVY3Udytcft+u9m18ttf5jcryt2KIAACx1j4Mwm4RmXCiSEVTCzQSWmMJtUA0oxwkFDRY0kahLCoEWRAoMwluYcEdZMBT7T3lawhAmM8TUJZVsxaoQD+AIRtkkQ4b4+CHlEqAbySuXIm4xi8NKqPEhZkF1P9rAliCA+TtEKIoLUeRzGKJkSZQl/TrolWCAD1khTQmh6INSkpUp+nq/cYStXCEm2Kh2dZOQDKvPSlWJDgKCUxafoAYml42H6uFZUtRIkxn18S1K5VQF1mWm1tLK7Km4kXJ33sh+3Ne1Zw5WMmh07lu985YqcqooYprDi4uLF916OJCv58mVr4d/9cgeYY6fVR2peJWoZ6nzta707XIOnLzkr7wllQIgAQZGVGNa9ztvamzvoo12RDs6JIaIbp7urhzvjs5m08vpBSKUQOyrI3OZq+Rlvm206hVPnnG13kuEuzErDSycUPDXrLbRAueXe1yhziHXqJ3uS7PEPwG73eTudQA//vSZLMCKCt+yWNPZVBdp6krFCayH/X5HQ09OMF+uqPgIwtQBTJMcuOOcEqoofMoTMihclASYwq/oKCPuZMJKYbWQminmo8/ii7SGDufCltoXiQ5zUuhwIw1IFiiW7qrufZvlotaTdQyigvimCPE+TZVIWKUDZKUT04S7C5xT7F8J8M4UD1DjCZxCU4YY1wvTcUeG0XqiFpeppIl9YEEroZLczqFKpd2yFuDR8MtxIGjzwmJRCQAkd2EhGBofD6FSQ+HwVWREFFDMMIS6yTLR6DAqoq5KajLdzUWhkaMqRxmDbbB5ZVlYoR4jTgk6Z8iGLTcwRVBe+TTttMuouQIsQsNHPBvl0S+FUyIXejV8HPabW5AnYgcZqElbOHHrMFsQEcJgBd6supN7b2ts1VhFYpdUPyBHNvVfeZ2gzS75/dEFKqrNZWkcNBegSJbLMlSSXK7M5Wmd7qVDOkqOaxqOu0tHT00Ovt6otis29lSlWb7/8rEO3v/+d+C0l/B/bUG6nHBEAAypxno8ozWhOAUgLMh06RjmVRtQRp/s9TVBQwVDZgTHrecJ/lLYaYa3JFZfAwCHCu41JVFOYYDYq9kid6Or1YE/LP2KA4Yxi2o0W4Oo30KOYtpeh/BKkaIsp1YPUSguqMKQhSUYme6KYVQi1SzF9IktpPh4vtIY24OFYQ5kPhPuKRclSaN2piPhSl0TjdRrjLXVTpK1Z30yi6QpjRxJEqdMJkR5t7ZOUvvcHqBBpcUvVefeY6AhMTaLICJHrSMFmEBM8LMz91IdFSNJsjImiNho8GCNwHMIk0hEFV0ziGBkKBJkDJGJi80TLKAigGVojz0bpEhSlSQ4l8maiR2VCpw3UHPXmADAAAAyFct1bQtLHdrKx9JEeQxbPOa1EnaNa/WL1E/abc1R05izKaQXC2eqpTU7OS6IKKh21RytkV7oZLFndrm0k1kdK32WtKNbs9Xekv2rI7t590a7UPozs1Fo6M72w33tdnf//68U8IyAsgFqCE0YYUBaRi3CKI1ATUSnBSUcWBEg3DQxKohGBLrAuM1JSKzEeVFIdXyzeIrpWER7LWlxFlixk+40umUS2BGQQaMCfsTFMjOUTNcLwv/+9Jk4YN4Q37GQy9OQGpP2LgUwpokqf0TDWHpweQw4eBgjEECnRJeQPIwVeoFUylyJ+LipkJjNbObj50czKcR/HKgMohSTyl8PMvbKhiD6VXZ9agSHiebSaSFQVwfyVVSKZZ3BOKJRr5vHq9WEWlVO3HCiYTNCby+xzxV6nYkPcz4dOqJZ7lOKp7Hnesp1LhqOt64q1jeHBCXbUk1YnW6E4Tqs+2pEtpkNKxVEngzOS7UafREji+PQ6WOtiQqpRyppcPTkQ4tysZVy5tjCcifZi2L6iRSDj2WydoyMri/KF4yO1IcMBUrKtYCDLlqOl4czVBY49WiSbAAYUM09qU0hFflSrAYnqutCpQEKIUT64PUMKc4QCkMiq0qYEy+kKmCDhRKrSLwhjuk/CNYQq68dnuZMcb0e73Wu7TSg2Mm0SMjxyNFZbkZOf8NknWQRqFsc9QzAlEoia0XONJoxUFjksxQ0sIkFBrhVFOkWIs6JTTPQUcZABwDZilJCFER0hJgYSaU+YVwYtEaIUZgCDgxjwBKDMGBUuScGAasJKAJzrC7eiOh7IWXYfLiO4syaGgfJeQJwfB6s7wxFQtM67Rb4/2h2XaCT5jdJ6DCUhemJTXX0COZ4hypQ47CzUzM4nA5mkhbetLy6Jekz7UypJsqXhLlChSiWjrSp/JJVPjrP5LOSwbzfCTygY0QrqIfDdH6+eNyQaUTAW1W4N0FLkjW1EnEl2xw0rI0dCm5ZRD9+pW5Cka1WVD9Kp1PnovSKVSvlQeCydassjV5sMRWxi8pNjRMd6WSvgqxlTytP9WViLad2dqthNhlp0/pVE8RjfFLaqEym29yR6kNFP3eJA6j7YaxTKYGeZCHiMOlkYGBKTt5Om1j5fkS5RR59tEn3qH/3yl9GfVUHFKVBQaLimpz6kIVxpBERV+yDxh5m0KRCCVeNKWMF4MxDkzoYSbZmaoo/5mc7qIj6IxxTRjK9xcq8e/U7KO//uPHu9BUidjnfM45s4sM9ERAYQDgcIjKJgcHA7kFlUvdRH67CgcDg9sRF4tK9YgMCAUDAUDgMDAUCgYAsyYBIDZgshHmB6GgYVY4ZigoXIGmBqBmYmwaxiyiWmbyZ//70mTpAAk+f0SlaeAAeo9oYKMUAHueKS257gAC5y/l9x7wAKYNIz5gJgFmAuAaYpog5hEgNmCKRwZOInxiQHLxOlucOZ5hi9GUXQYHAZgwAiAFGJAUaNPZmEkmIkYaZdJ3lDp3mEwCtuWDw3MejkyaWzJ4dN1o4MrhwZFGoFANB1r69i4k4ZSHRh4DRExIJjGxCNCrEwSrTIaDNUPw2BEm0Tnl9NQPYYuAxlgoGPA0yVVEeAZxg2nQX6bxno8NjdEQOpYxReMNMlDM0+J0FAAySLRILAYGGEQSYRC4KEZrQiGDiwadU5yVLmGEmarCZi47QQ4b7OzTN40zsuMKgNHRMwwsDAgCRVIguAmoadIxmooGACSaEDBhselwQUjzCBKElJG30rQ1QzsphGFuiTkZpTvKietdy1ztPexc4hBwgHJjEHmHg+isBA0RBsIHCdhgoFjoNhTzRpqT7O7cZE+TWI6w9crux5e78TcXVw9bT5a1uB3Uib9tMgMuUCQKnij4CgqFAGhkMgVgjWhoAl9W2SpSw1ru953t54Z4Y83z///////9+4RG6OediQOJVn3Li+P0nP///////2GIqug6ygUXWFfdiK+nlYc77zPa74AQBAoCAoFI4GAwFYkF75alOe16qxzC/EYhx4MZuYm56o+VA3L0pRR7QxQLjOpbxLyznWaiwiGjFL2ri+mdnfwmJZ0i41ICg36TQX6kWrvxaUKq1KBYgMn25z6g6yaAtaugJxtWtz6r8U97+/x/jT1NoY5OD1shuFLx/4m5d5+M5hv4cX78RRvmTThuJDtH/vJEkiY38ZvSPadWSRIjHZ9m8ajplh7mSLoaEgxb//TqOCpX9KgMCVpIAgAAAFUgDdQzVPTeLTbOTgRzOETdYT6azhtDctDSkDQlDOlgUSMWaMqIMGOMhcDSgYkvyg6AEzadN4swDzZ8O9BsxswHCESCHHYdLRoxGVmdgosEZzKCQKsgbUKnGFmhslGtZYZ3gCAPHhQUuwAASYQt8AijIzNgg0XADCdRoOCAB5gMArIxqTIOGlk10mRkEFIgExf7dASEgGLPL3i7/LraUWiZ6zxhYEHDilOi/xggLzQmInFATIC7//vSZFyGaSxoz59rIABbxlot4YwAJfGhKs1lPMFWmKZYNBpgJfFhqXpdlqFdE1Cm6xJOZIaFUUjfV/Ya/GM0kajUal1LTT1aNQ9bz3X1u9SxmWynGVVs6bKtGpdHrNatLqa1nZyqxmljMV5VsS6M/SU0NSKxU32Ixml3yaf6NUstnbFbGdsVcsYzZpbOXdXqWJggAAAAAAPZZdJbGOitj2UQbYwl2OhxKOpKdJnU1aoo8MwmTYUg6hToDgAEFEsOw4Y1JV5SYxBlYOioKOicysl1aZVS9jukMj4sGgLhxJjBQlNhy3KhoKnqwOPYAI3KU1boz08xRY0pJOU3y80wwLFTfpDikTKn7YKZBC4zCMCLDDsCgOZkQYc8mIWYMCKNycMQVMk1A1cxAcoKhUIZtSCjg1UTnAIEcXmgEhyILsxpwaRYD1Rkm5mCpllZlCINRGhBI4HAXjw0zqQyok3JwFTyoNM4UM2uNmHMEJAFI67AWgBAcsiPDTCdPgU6/DJLHazNmHHzU7MtQdINJkDMNMLAkwVtCFU3IwUimgglDhzEhQDQ4xtTAeSYYFxC+bTCqKW0Qmlv0nk6WiglJMIeJXu6CQDoxly4eZJhK3sX7PPnEFg30gl0GTy2ETLsuTGo9TPRKn1il1639RicyZmIbInGlCVzD2h3V0VMKGSGD0QA0Z5cHkLESMlFU+jTKPjBZhMRYVg9SpHmEpU4wB7uylWBs30qfwMBKsMkWKa4FjprWmb+FDkVrhkEP+GZgmvWhBDEkuEpOJJErnvRyW9iVO36aTODAsBnlTusNYaHA0Gj7yosVGv7SKfBr7riOrnt8rUAx4gGMjGZbXpptumj4SchyJ4Hjnh7qbNcpk4fGUyyZ/N5kMd2gcOBIqmBxmYvF5hogDQdAQDBgLMChQwKGBEBi8JkvixRlNmEKY15zHm0vcB3QoGEAmQOhGFGVVTBgQCGgCYwJyxMRBCCRYNELzL6ER6oww0KJmcGhscaSV5rAAYoFFBaQt8i4LRU5RcHJGSgKgFvW4mQOaDJelxlirjIBAUy8hdJTYFFIrJkv5B8egKAGnIBVqw+4SILzQ0XCYOiitoQiiQqUSgBdJxWbMCb5sD/+9JkaQ7ppm7JC5l89FlGGVIkZk4maaMeTusogXGdJETDDbjtQU4r+GCbi0eqG2JCaypWlypXq6UpyvFclqI+LEgyNCJnUL5QqFJp1QbLbRya06wKVTpCAipbworptZ6ukJgUiW2wssNrV71cJeWJfDK37lZVqC+zBhPIcWFb/////z//6rgAAekyMGzAubNrsoKqqNTyVkO746XRUZVYjtEem5PTaiRYibx9KumisJdl10c1DZ5z4yWU+a/LCUFpDoVCQJCQ8eCzXxW0pcNN3oG//zEW4uwi3jN9/0f/6waMUQaARyGGqMGmbZHBqoGC4ymQIeCxDmaR5mTJ+H7mHZBG0Nm4mizwy6Q7b4wKAEjG3QaIYNVNQ1G4ofdksknUYxBjlFQAvsl+RBkIslFQAEkBRRgM0gwQKBhVNi0xCG7LEGdIJkakrgMMjfGA4oDFRQUhLqsBDmi3w6IBRDPSQWAgL2pzq0waxJKhzUUk4njUxXQ1dajlJ9qVuQ05Qx1lKmKrDQzC3ZL0KXydpTAV1Q+IwES16NTij/qXK+qQuabZuTpMSwgfKU7YrZkDv5w5I4AiceoKeGn5ls5qVupMRuWr3gePymhd59ZFbceMTL8NZhiYn5VPzkZfeN1ocgh2nhjVaB5bL47CpVU9+quMOSCDI44FqkrUPaWVRmIzdmB6kAX6sUlswINRlgIh+UyRQ4UG6cohyPnScLo1zZ5aKCiVX7rS8wfaQQx4pNrIA3cUkZVY5aSseGglEcPQWTpEisQSOQlUwZqbhm6BdKKLpGsKLKxNn1CaGFQ+tz2RRdQrTJirzbDy+4jXr2dvO0oCAAHXUphKweSLGOmZuL4adBmWNxmjOFT4gOjc14Ej5lAeW5MLAhkMQvFigaSEFzBgMLDQCAhYmbdhAVsmcogjMGiB+QhwFWPfQZc0KAAqBW6gaLaqYsYSWHFUFTmWSrl+VLX3TMaagiUgfQAc7ri1Q9S7CEBjVOgAAZp4kuC+6kQgSsogSuVEJAMuplxbdR1hjUi9KO6qkveBM9IFvXcZs4r2pLIMNOjdOthMZK7F8BEOMOi61Kqs/1hxn6WVFvJ5fHzTWNaiVmZCIUJmYsE840yMi//70mRqCymsfsYreGT0XGYY4BgmVibJ+RYN4ZPJU5kjoDCMwEqGVDwadVxvCXEcRFlIVYj8nF/GiuVDJaQkDQrM3zlDj5phESkM7LSddGhmi4oGHHpKiXXWHSAvQy4rZMaHSg5M1Zfu/SE8R4SXOPz+GWzAwY4wqsXLFdj1tfyVI+wxX19wDUkbMMAKLTKYhDzTEygofSITOF5Wcl5y13iS+1abEQkFBRV0WYclXarsqESTJsvzjvrnu2XMT1vIS4VJMm5TM+gkltVIJP0f+9v/9y3ONPBcXVOnQYalY4IsNSBpIEDqYxI6NFUzR5MWUzM1UCngOeAh/MACAIBAogJAEDC4gGwuBAICJAsKB4wBAoAR4FhEUBIGKDgkBQBXZZcMOdQBU6OShZC8gCrODjrcXaCmIYA0C5UdFBWFZrzh8LgRjUeCNP+ZkkZFBDiokEIRGVqPhMtiaa6RwOc4CKjQVStJV8IkFvUMFH0RU3AYVtmTreZErtFpqsbbG1NlNZjjpvAmsu1nsYlzQ2xuI1VpmMbdCGo2prAFuBoGZCYFhxk7EmwfYhnofktIcnMR8XXSbc4GIiFwfB0FKlVy8gtiSHhYJsQ+vKmGmdXj4aQNNrw7gQ0lccKrJKuXl6c8jrRh1lcjGstktBHxYWGxOgWFkztGiQsJySo1E5UT6aP8UEmxZy6FykkFBEhCQOTsxWLWMG8DpNjjAA4AE5VB8Z+aXhXaX1c736AnqIXzYxMHCNDGIxcdIBRTpexdGQKG4EITgzV3e78NgaEOKSxwbPvQ8SprX4lb/anZoT2uQoUOa0LSltY78Wf5vLAdq0AIAAA4dOMTNzDhokIiqtGoqxpKcYOEGVFal4CMgEokxeKBwhFi0hEhlAMlskmyZKVrJZmHAgEWqyVnLiPELCUv6RDgMVEoyuVIBYBLUaqpY6sLjb8wcyJWJIFw2KobP2XsUfbAzeKJAum9ohM1+H2HONArCkrniWSo6LUTPVtrL5kDHFqQuMP3BzQmzxt3nLhhG592CtE9cr+Pc1SKuw+8RaXDr9zsah+MQHCbUFy7QVDvg8LBuOhOZUGhLMCXZXWDyuSjIc0akqlUElZmo4m0XiCVjt4S//vSZGuDeVp+xcN4ZPBbT0jVDGKeJmn9Eq1h7cFqp2LAMYp6W211l6QrHxbLtClAgolxUVj2eoag0OUJdYvlzj1MP4fOmz528P6RetrGXkIzeEFcZuxsldNjfJIzlKU7qjMjIzl85jgooZVHJfiwmmq5W/6GpeO3wYABH40DQiP587/M2WczTNpszPPluRnOGQCpLTnWiQjEmqhhVtPUnQfBmqtxzQpzI1LMy7DrZ2qlOR9N2vVurehG/9qb/6dE7c+2//s3dNXuira9kpdlSrBYhpBAZwCaFqQMDdATTADBihkUcyEckAYoOFWwcpFiKAYDIRQIiGDSlrke5MgNXyiKr1lsLTkGgIdguEGCACz4QvczpWBgbBExFOWsuOrE5SfC7Hanm0mEj2VviKMLkQWFhjDHOXyhChqxNfUpJQlMBlBRF8AkzpS43A1wLRVk7JcSgb5KSwF5H2oi3mE3GAyjhOmRNrTofYx3MkBoK1zDePlKiKp9mKpnUzy4uKpViJjubnshCGJxhYkIRyPUBeGhSKNNtzA9tVVPVQbDIokW9X4ZnqCqeVrWuzzuuzJgoZBYJFpLH+sJ7R5J3qdj0suD9pVScPhGMEBVqAyjmiQls1nUYxm5cuKHwMxmByuqcGzhPxLpqaOdkF9LK9QxPaXmZZSGLwoSsjToYjYL4mjtuYkOZX0XFxTIoxN6a+RleGSV3MqrVsq/fLZoDuSNeOWRUumGN27iQrGvfme5MamKDdOMT5SdtIrP/dPpZlvdU/afzoO9vY556k6TAgzSWDq1lB4veWzjB7kNawo61ibClRCUAAA5yU3DsyQAwbwWxmFKGZZGKNmWDAVEYUkiMoCKAQsNZgDQzNnff1oyXADtKQY+m5SgHpNAJ1cOUc6yAFzRKkWxcVp0aYLXZosRvl8ZCVtw6iCFiRAkylFpOVnFWlCXtosC2eZ8wF2LAWALAuSWbilHCW8vR84FNhNg7RoJN7KcKEImiOUInFs7BieEsRkRiWQKDVQTx9PzFslnyAjSmR6Wo161wSDle3Qutoh2J5SOTx43sXyAUCewLTgdfXrRKjL40/hJViKnOCy+ywaE1qzpEWF8rER4to0EvnBYgEn/+9BkcQO4839FQ09kcF3OqLUMIvijKf0UjL2VgZO7YkAwj+Fg9QqDqQjUtjudUZJJ2JasKWUxue6tVnen4rHwvJDoRC02joOKkRUBjyqeJioV24vhbYPWSQ0sHCI5MV3gQAC0m4i7EUlWdnfI9/IyzJpC+mRPWrK2p8PXLI/jxBBiTXFhAWRvYNIaGy8QbNGbPQUq6eiH6js7mJlCh+TGatPtJNQF85kEndGppSM07J0TuheaushsFFc9bYRJAAlwkA0mCX82uDAePGcDTG3UFWDZG6NGDMaAgFSgIcZHGgHRTqKwV5F3nzWYyNZbbpopiN1ttZVDsHac49BbUeIScKGIlUPz0UdFKnDcufZb2IfZ3XGIn1UTVZTRbEDHcUwWEwBNSmMol5oFMp1KXJEKhlbWJUnCjFUdykfro5Ue1Kw/m5aZWQ6XiKfHSUpi7R06gYWTbiklAPiG+uLgyKZOOB/SriscmsRCHATksBWSm6g7QLmiEI/klxaYKibw5tk183LOj3CUmT0cOFPE2HTJ0mnZFWkcvCqqFClEo4OXwIQItKSJahRqUp8frBYhhCrQlT5MOV7A5UK5GSoBWKlDl88PhqgFZVQxp8nUKilg2Qk/HChMR0/ODhGzfkXnl3nN1nJkeuxHTl6x9I6VRiKzNltUp0ghiHQdmhDCBIBIkQmRCIZhsRSoY0WyC3mTdE6UKlLlgYonBrYwCYjLKcIcDkYDJC3oLAQsvdmX6xERtzXIk4tRsfVBVSo9VRUItqMEGm0amIgVMZh/y3IgEa2g6KOqPmSIxMSyRhbukACExIh6j+QSqExc02eiTQBinAfYcY3ClHKhImRjIaD+eIapidnMQiFKwlwnUdkeoG9vbjmeISzqIuLI2Mxowx4rptMhSnYhzCgG5wHoriCejY7PgMl0uKA50cCIHBi2Oxq6lMkAliCh6dGqDCWh/hKQnj8tXOjoUk0KMT1gkvnFXaq+N0KkRgTqFh48QFlztSmuQTwwheSKml5+lNVFFA5Hi4vHw+2kleUV5udlFDEhlLcknNlqEivpZJdCuVj0dXD2OEtnYiQmirlBxZcS4hkWzgmq0p8taMlZyfGKZk4K5Ug8zWKU//vSZIMDOGR/RaMvY/Boz6h1GCIuIkn9FQw9j8GgPaJgEIx52tGTpBtWMEAACD/CjTSCfUvejQTVOeJVSnkBpj1O5kuiNui93UENQ6jdQ57IMUh4NrNBkP9StTXh1BlDefScfADI32DBdvMzcylxmUmErP1Uojuf3OWhWJgyMEFwbJ6lKQXYqE0diAmwQ3qpgdmiRT/AHiANY84UMUXJBkC0WzmArCakFCihIwcGseBMdFIPCvEHqlmo8hMReQQUtjrLbAE9LwKWV5bl2iFcgDoJYsNdUQ7X1KfSKWDfGkrlUQqMnDKGscbidyBUQgK0aZ3tpxGfHVB0mwvPh7A6HYi1Gs5AUSx/VWQDmRCD4PjN5WmFNCqNQmrQ9Wvoi4QYB+NSRUtE5OZsj8Qz41OIIzkcyurDksFXl7ZycmA4rxBXtHWalHgfD2EzXCKWlmD2IA7ePWFRgcW07CgjOXVnK4OnSeV0FPpaXCQmGRdWFdSpRFYqAuNR+enJFQzAqFMjrlUbCEUxPgPjpUySHipGXnx+YOieNI7aPj7ZktjOkj5OOS0atVEJEBNomO5M4maU30SyZLFxz9tMrFeIp9BRZqxDa57VoaUzVzz2M4x50m6OZp99bYy8Mn96dv0zpLOnwqXlrrX+SP1tXvXK5zb1RrGPfJ8zP2ec+F0llO08/P+vJ6bM89yisK6dGx0KRQ0moyEbizDTyRMfQFBpho2kqQ8SAgDGOEhgaYCDBGY6SMkueFqXQRUrEMMcvY8TRMI/kCIChZrCJhDy/LlAFcCWTgzFUPFKLKTfH6WwsamOhwc4BqngUCEr1BukMMJInAT48lY2nUo2VjUROGmA6OhPPlG0XRzmuDbXcdLK9wuX44G01T/W0OQ5SMi7RSNLc9X29SSSH2XwtJYK4rFZFCsy0Woxf1E7skIbEhjPEbapRWRqLo/4C6gJ5uqplBquoURePyGwRy5omDIyEpNBRR3jYhR1xj2XTxhZI7OduWRdHY37R7PUvDydriM7yPcyGV8sXc4ScqrXh+w1crGtGqdAuC6gIt4svFzRPm0/eXowsiDivMZ5u57lQgAOqG0KaIf2lerEdd8YyuU/6sqqdEdkzISHsXX/+9JkmwAIx39FJWXgAGMOGIWhiAA1dikKub0AAkDDodcSgAEm8qukzoWYpWPZGRTqhqknmPMRizFcasjDhfOI+G9i9SXgANyMVUOQioqBFVhcrxSfr9Stea/0HBsleR3/2ZxLpGgI4sraAwAAAAeAkA6GNaPwAgjRQaWvAocAQEc4QmPkxqxGGHogJwETGPqjNlVTIisx6g0Eoztw6KIzwAxQk2QwwYdRcR2wgMLXjIoDgkTbAiZa7IKIAIYCARg3RfcaIhzgECjIgRbgY4ERCmeOGHBzDiwYdMoVElpjApshSbohKBA0oXBChKooCIkpyMkCC6CYeENMLhFohJUYsEg6ZcOa0SZYoXtiA6CUzehTFK1R1EBNUChk43+X2X4GQpjwRngChKdY8SIA6AcdCvyzgSBLXAw6AlK0+FfNxZylstwve7yHQQAWkoDuLSTPcheaaq0HjX+wVmCCddrmKdlyy1TdGaoNxIvwyp5mEEQpoKS7mIiM1Wm85caIryZaoWABjhsWSKSDZWvpJtTyPy5ExR4NLBEAjz0PokarkMBLMcpc6myYsakCpUr0Ezcks2VMdL5slQWeUSELlSHX6uBoxQAWS37E2PomjoFOlI1B5Kh+13NMZSnH///////+r0aAqJp0JoscTTYC6CcyjTM01VV09Ewv///////1rSZMaQxFh5aFb5btAJH0HEUSIQjuX4EAAAAAfAeKmlK7Mk4fVvH23wl9/I+5Q6GjY2rcxO7LuZWj4IhhkNVRV0vNaCjw1JGOpYS5iKZZfueqhyh4yTXuIbbmB8VLn1XOlRyo0dt7F17G/mHpmWJBVLFb5ERxKHN43h7IPi+5bxr0GxsEiYXgUed88c3iUd4kyr/////Kv/8in/////8RHiiz3yjDtNJNIuyJFEoiBCiQAA0QOOZpDdjM0ZZNgATGyUXgDCEc0cSMBGD0+QoVj3WsEGgQLhEKKDxhJoBTRjF5lxBrAgjSqqGRXG1mG/WiEaNBBwgjkXhMMEDRB2J5uaBnmaE8viwYLCIPAyktEMhjjOQCgMGxMqnOYkL5KUFu2YpZKOJClkAYTcY148zJAwxkwSoQFjVh5lLt93SVE6ZhARMOSf/70mRPAAvQikdmb0AAcyfpCcGsACSF9yF9nAABlJ+kr4KAAKXQog5BvDhsDJqUhiC4WDlnAwGkMBBDKWQiQWIugq19EqjPFwwDCUNERlIqvfpIVuRc5aaYijaYb2s2mZq2666Ez2BrvZPKlamwRJgstiTl24duP1VpInUrORRTtNGZFQxuBpRF5DB0fgSJOtLbVqDoef6Wy6arV36nZZLYCgGYjcUq35A/d1/6sBfUpaeG5dNvO8HZFIYnPv1E4Flk9I9Qx/ulAExEaSpYuTsN7gC7////////LqsolXyOhsVYejMY5NVan///////76yuBIYpZfap5yRxD5yQ7h8AArJEAAANQAAcCNWIZTwLPMpIb8r3e3i5ZylX+85KlXfU7/J3Ocb/3PMVymu6jjI/3xE2s+h0AOxmVAMh8Jttt0810cWv+WG5vF3mhye8UirqWpAjCpQmpMcrbPmkexB9J+kc0eQtV+OUmskPf/SlDiSUEiyZgAB1IAQM1phCsa4o+wfzoAVMCM88xIk6gjMVMNIcHAh6uBYhd6S6JSiiQhduOwuUt1fxr0KlSM6wagS7Aw4XQsAqNYZJRMYmEHPXKBhteo4tJ2ANVlFIpjWaMpbA7g2ksk2Vb09n2glQdmarkvH6Zc2NgFV3UOjuTK1Gulq4WpgwMKlCFIUl82aQEjOmkzBQl41V0n0l1Nryx19wlukLXhuN2rs1SySVQ41hu8pb6MwG3POUw1ejNSnpYfm85XDFmvR138tyyC5+1O6v01JjHKSKTclpqWtFKCnfyftVozR4x2aqUVjOW3JVKbUWvSOJ2qm56alHZFM2LtLO0lJQPvPU16zZ1MSi3L///+7N4Z73/f/+91/z9Ln//3LnP//lN8AFKMAALkJhUzoxM5vH1EXC/eymFv3Syty1x/P0rx1O3NNtD0YW83sp4qGRGNUS21C7jCKGC5bWPVs8lqq66q6mDhXyhpg95RRlJIWEiEIjaCUyHRJUUaLKi6o4/yNS9yOtQozylS3ddEiIDxCOdL51qGgeWJiK8umbxYlSFHTMTSAQwMpEQAmACEAIKoLF4VKUtn7UuYoZQtpyHGhqaaRpg+QYgGiBOtQhIYJi//vSZCOBKCV7R6MvTPJgJ3kbBEOgICH5HWy9NYmlOSMgMwuRpw7RjqohzKp3FETxhYqqkyVefSkO5cgXTiXY8C+Icedg/RvgN5+jpbyTG4ohDggQkgjydN0MEfQvgQooTiI41h5B9lEBmETH6SosKALCewuRTnQY9jpNJNPan5HQ6CPZEQkYOLLhFMlTeKvRpDNlkLMbAVwLU9lIvJblsZImI1yJNYovTbZWLTBKQNPURGieSJXxW/D9nlkl5PbiJGJzsng3YodJlY7tZqhDtKTyZ7wYuHqMUz389tQ3QAQn2CFK4SABONScaGHQexcs9wqaWZ/JBVzzK+tUpZlIiOMrAR61BAVhVmBwUot6KDhBQQKtGBhjgVMp8jFhTIsHEVGREwOtzym0LX8lMIoY99mTQoyGJV51rbUnDFTxYkzTqKUt1dBig0WlP8USCIiBr02LAdUVYgitEVHoAGJIM9TOT1JhVcLiWIlQX8ftRxTWzQOBOO6wsiGE0Qw6jiULmh6rYoVSdKVriypxTXMVcG4h6vNljR6PQ6LGLkm08nGBXkpJOsp56pTkfqg6DRiLljFKYiXssVJl6W12hsrSrFhlLYcaojgnT1RKmVDJRnSzqhe0/FlIwaNIyMSJBtCqTRBIeKBA4yvEy2iPNCUkUQq0yJ2CUgIZdYUwESFWLarY8hc0SNSIQLP00yI4oWEWG5YgXihSeICSZwgmmuKi8h1dfIE65uTkAqJEdwhb0L0iuXydC0StIFyc+XSYTQrqTSyQEYpAEpmMU2Oz8/8jzvzuRErNGZuzSH6a6yqF3M1IqvaO2EIptvn7ifJgZFA1o7qLzHhlLxKnk9HOs104/ltKzZ62ZOzNVruVNOzraTerM01y+7e0rV9PSjLZVa9731KwYBBAjZebBXfAHN2AACnphYYkCnRa6PTsg9h1OI4tLUiqiUJDAD4fGOF4JGjh9j8RJbjAfjuJ8aQ9YGgP8cKGAM4r4LcXM4gVCvc0oLabg+ltZTKkIemni5YwdB/C3D/MYJKiBywj2PV8iUiXUSUR5VG2bZ9H0TJQkaO8uKuHoEiF8hgYJaKCQZ9TsJDgekSUkziJYuLGhAKpXGMT8/E6jG7/+9JkTAPZKn9Fww97cGSuqJAIwtYhbfcZFZeACYs+ogaMUAKigXaty5QH7xRGU5qxObVShOEvritqMnTgfqNR6nQ3DiysKbivV9RH8j2M8U1tyR7GaiHrpcHUvbOrqlvboszKoVDBUCLjnnFduC0qT1S2tqU6YrY0WUKWVT1FOK5boCFqNrjt01HpVIcuGDTa5t7CaTF3E4ysUs0VjfN8Jxm0d1X7MyQHJCbMTxFo9vnUpSlZRG2/t9ECnIYNQv/R9SUOVVp/bRe6vx/2qe0MVoF7Mo5x6LsWcbXOWCOZTvZEUOc9EwuUDiaeW1Rv1ZV9StmIN6GDC9ESgmZsOUv/1/+XBan8xoX+gZgr1dDCJjajfBmsPnAyAt4xAzbcAgRkymC6b7bhiNE5mDSONwADCAoxYpbdQdIslA7xjk7DDEnZxDziElQJPQoQNBCC0N0hBMS5GyXppTJuk7L2HIfB6FApnFdsagVC7sJikEUe6oL8ok9DNE025RXQ5PGwcCIeJxKF+LM7lJZD1AfdDxK2CxtBwuKubDKOpwTLOqVczMrOxNB6pR9ChQV5vT0eG0RZnyGqFLrbZDeRWy6RgvJlh9XczNthis26vp6Qmp9J2+j2iejR9NLXSq6etsNeZ3z9QwJKrbnt2/fq2A+tI7VzW8T+Gur2A3phXV292rFw8uwUcqNUN63RoUd/GhOmPzszdAkP1y8V/SE15fK6OxPYxJGoiARNohiBkNEY3IRkVaOzN3/9upw+H36jRjNIAxBAepznnOYOpa7TNXKHheQe0qoZEjWlN5iJqvzkJnE0yEbj5m+ruNnHrvbGL/9CP//9RiR//8TFEwg9G5A4KMP+Mf+Kj6AgKBdYSgGTUYj2q1ozH7BM92Yx2uQp2DMCbNFG02sajlSoMeaU4MxTKa2CgSGY2chQpog5mJ0AYrCA4AzWz8AgR160de1mIvwYAqaGaAhnLWJDpjJWNepgACOAibpmYWZaWmTh7zGLqBeUCGhoYKOi40NiQiJDJoYuFAwSBC3jiGZjxpouPHCfA0AhYQakIgUaGy5cJMiFh4ATrARYCRUAipg4eFgtroUEQ4dLoLCrAIOEIW6oQHmDgqFbLFvIqP/70mRgAAxJhE/uc2AAlyt5fce0ACMdoS5dvAABVhbnH4YwAfIFRQtuMhRhICAQRgYkGKcLkai09rCuVhlCGdIoJMJhwYytd7/mFA5ZpAsGAKhiA9Y7OGPP9BCI7NGhyGV3K6a7AG0ZJbpHUdN11L+oNLPVKjqthebtrNTORObnO0lBEoTlAstuUWoujm2RplaxbbOuyHJZGLDHGto6N0EgJFliCRaQiZSRaFCaq4lulqWFX7kUh6axhvVW5EtxyPYf3/7hyxh/P/Dn////////6kEnllJI5bynnKsxdqTdT////////LmNwiCzd4AAAAwBAoHAwDAYDAACnR4n4UgwTJ0hBGR0nxLVnL7CgRxPx5l8psW1mdYwCZQHwSttIwLjF06OA8iAIgbjqk89kmkVl8c5TKQ7AuhLArckDRGamY8ykSEvkMl1IPY+eLUHmR8pukWs5oinu9aZl180ptpvckDRkN1r02mX/tb6f6m+YVNVTM5w4ETAq5xsdl3qf/5V//oAABzJBY21qNXTjR6Q7VeNbXDbVAw1CM/EAAIgJlMUFxo4LQmAEBMHBA0YWNBa400aGRQRTfCMquL3NBBC0BIuENCP1Fmj4gQlfoIGDkh1E1ZMmqC3nJy/QZ1gDhA6SAZRRQZ+AQpS5DYlAm4jqKgMJBCZAMicIRF80OFG0MyHWu0uBQYNERPSZWmlouOHGbtmY89CHsBNrEXrStfUv6mE1xAC+MsQCQMrQ01s0SVXHQOE+sBx9xJl3ZRD8YgK1AEUoOxqLxh2pI78UjUvq4yp64zRUN27GoetQLyl3HZVRTliKzvOQzH35iWUUoYplXq/UlOdx/asdhiXZuVGKXKkmotPzMOTEGTdW3RR5/pvK9H4ZoaaKS2glaSwAAA7YGOCjMy6S+xaQt71LCNCPu5N7JVvFIKpIwYnVRQp5UjOTVVX9EZYcvhp4vHiv7/Rv7e/dhz4rD6cv92JvnTq+FFQmXi3Oyqeb/P2UPq54qvSCAAADHr9CSE+09BU14gSMGwampGm7WGVQmmDA0WKDR4oak8bFElQY08GAR4qIwA8CBoMwBQOBGdCIRIfL4XesOHNfUHKOOgUZEVK4QNawFzJ//vSZCiCSMdoSTNYZPBRKtl6DCLyIXnvJS29NcmlryKA9JX48CHYRglSb4JUpeqgXivcROGtjhhUyshetHRhgXIRFZMloNDUglTxwlfNlbcs8IjsMa4nfMPuxiBXhd+qpg37+qWoTVabC+EomZ0C01GgSQvEqlhDsOuivlSC8pC0JpDx4TDPbDow3lqmoJJ2NROP2RyYEcSTGhO4i4VjpGlKw0KysJJwnCo4K9vLwlGTpzrL5NRmR8oofEF2AvtkoSDE7JLokiLolwYzB9CqIT2wmQnsKX0IgQuKk5IX2JLlvKB/D9YPn5R0oCYTIAAEEmSioUQ1s2OlVJOMzf4USWgIVK3Gb+hhX7az4KZxLxSrYIyI/h1SZC5hUKwoTs15CXiE50dRqG8z2hDzf+uG0Xy/+JBU7llPTEpz1CYAWFBbMsOzNzs3wAMSDTXSE1iKMcazgxYxosMeLBAEDxsZEVpGlUcjyD4OIQYBuagETyeZNJPpnbeLAtmfBbIcA/R0iOiRnu7K05S5LrIt4wCYCbLZdVI3vTwFsO0bxeRyshrk8N8yS/jtLAJ8rXqlVBsnHUvI2VSck5vI5cKWo8s3NJpNFuPWjWvj06P1dsLOjVYhqaYEsokJMpqa1Qqlc5ulPHaiXNOnzmr2ajGst7hdgVafmbqPWa0Z4TDAiI12RSuhIFkeKAWqKoDBMxqzi4pee5tYTmydy5YVkoMDQrNpEyiREjGSALWZCzBVElgYA9lZPfdNp3Ov3L1Oed9NR1/2Dt3+cHenD5QYZZlmI4EHEcLCM9SQqW8OqtULLt+576gun+WDRGSwhues9fPDPUJzypEpnIgeemRAk1SzRoSCT0hTN/1QnU52yN8/UGWeAtCQi/+36h5jGI3/Vh/mM//1N/FOIjUSNdK/Dp/EBd3+J/uL1QAsAAAEVBkB2YylGbnAFYTPgE086HQcoUC+BfQBGAQVCMBSMRyXCngioXrLIFAGxdeq/lgRbClCFMgyxwDhBfE+XBIyCog4BdY4Y0xCkUdw/n5hoxFkPEGP8bp7jJP00S/HuPlTj9JslE+hJ/EKYGYnI4JRQjtKMUk9EgghPh3ncXs4DdUi4eEKQo3HCIhrKW3/+9JkSIO4bn9Gw29M8GZOiNUgYp4hrfsbFaeAAZ04IwKKUAFyE2lTaigL5bVUqn6iV7fSEwqw/aKTIREfER4qmXMk4TWbgVHUmJssjyvslyHmThsxYEo9wlWQFFypRp4ocymSmJmcmcXTQSFL2EZESEFHUoIJKnV1SROaFuo65JlMU6LZjK5IbhUaRchSgOLIhw6iHidHGa7SBC9bUnoGLAgAAFCDTFiowORXne7jjjlausjK047smQ6UPQcPjoFJmpkdVfpvTqVEbBO9/DoxMq7kSJCzlMrZPPJzK6kqb66tpXb7IjtI1e3+y6Iy0R+fVqazaNbdWLvQVcr453QhPUXBbL7irzkokMHVNgvGSxYbGJKhncCvwgQYE8yUwppK1aiN5ih5dlQl0QJYBMOMSUeJ9i5E/cQg5NC+AaSHTmgLcZbtOKc447moSranE51Cuj7L65HwnFyzwUWo1qAyWPwmEKIiYJ5p4+GJPn+Tg5Q+RJxzEGcWEuSwSFygmQNxlLYtmuiS/La0ba+uVOqop3NSwbNnJkb4sdTs+VtqV6ywOKeclhniTZUdVLGgw0lPl4aC5hOD/TK2QrP3TJeG+WswI8aLDtpwhrt0z0c8NTx+1NivclVurDI9mcXskGsNzb2CreyWZe3NB11l2nm585VivFVmjC3t6uw2KNqxEgZs8ZXjE4QKs9HDNNt7W+hucDEWwDjkRjs8xmrbt3NRhpRkiu50fc1XVkdmdSMdjOQkjJZCRI4HD48inHrmoyGOYl27qWplVFXWVi1bnpTVXRbJQyHIyXT25qslN9q7PTL82lNZbv0b1u6oxSXIhkEkCEjkhilJ1TDjOSIAEBQFBMojRRkUAAxJBownB4FDsGDAZolwdBckLDiHDEYkCEEA2cYCAZ8HcYBBAvcGAkIgWM6BeMmyLMKgBJYwQCgUVThgLNwscYCZgYAF9QUDwgfl5zGY2Es2ZeEhZpecUHQIQAlGdiCzGumdR6YaKhkgGIHAwJKKhAVJgSFQA2EWCQcD4fMxDwwOPzBIMMWhoeODxJes9ZIsCIgCrQmqqu3Av+3UyCNTEAxARuMTBowADkl2FzLW2GNCeVSCs6MSG4hA66mWMP/70mRkAAyeikbmd4AAktEo5cegAGHNmTf5vIACDaRltxaQAEMNBwEjAwoCzD4RjxgoDAkBw+8UyoW3sriUeh552mORJ4gps78ea0QAUEgQSCCFBcNAI5TJZ9s0FO3DkAQvGB3QbFE4BvW5XbgBrM06kgoXnf2G2hzret5EohAsahmVzkRYlFI68eMhdiORmRTkOxeCeS7sjh+xDr01OUEhlDsQDDL6w8+l6nhiNzNI9NeD6SUzWViU1oCoIZf+biEqw////////pZJRwBQxSfl89OyzO7AN+G////////5iGY3+5p97cESSBo3SWKOhEAWgCAvt+/T4RynyryENv+NQN/bh6HcxHDuRVt80+UNQPItlpJenUR8enyKkVpsWe9Wxolni2veXi7HATDwSyEiNHf99lpUHjilkOKBuIg4dJY6uO9e57FK8fdJSC59lTM3mT9fG81//+u3x/0OMviLiomrK7kmP4l4aL5////bHKOaUvhqii/////q+Rlo8qMbMAAACIhVcQJVWW1OW7+2xwADhycEYGaGUhQoBoXnDt0ZQbTmlL1mbjJsNINGpiqEZCBjxWQqG6iECrpBQTyFmUeU8MfmGpw6wBGdB1AII4hQBlYJAAoM6X9SNZwo2rUXhVcs9VARiCIdWh7l5sVYsylYVbKKSarxQ++LxuIy5a8eksth7OW3trye9USwsdeXBlKDqw6/WwuhFmVQQ/0AvrNTzeM9zcezKIKlkXXQ3qkn4mJQ/0CwuNU1aIMijM7KK8zSQ3R5y7l+guTNa/XppijpKa/PzsXxtVZqYj8ruZdrUl3DVatYs2ud5V7vv/l9XGvn3LHPXe41aS9ykyx7d7uqmTXONb/frLnFfkFD2AAANQlAJAptFpKyNolMAfUTqsNtvFp/FuzxzP8r//5GdT/91/5fN+VcN/2cfV9dT1++PuagpRnDszB6WlyqYoDpsmvIiJCxgQMBYPkE+xpGB6p8unJI7bCNYiWaQR84yv5sFZtOuVyi8ILYOKooyXF2lU26xckUgW0fIqr///9UT0S7qgAALCTJBrCmBjk2lFMogzDGY2NPPUMzlVQwN9ASmAC8gAh40LqmBE40eqagQBVA//vSZBeAh8p/R99t4ABtLjkL5IwAIHX3GW09j8nCPaLQkI246w2gHYh5qgSRPipjFjP9UjdOpREGNIm6qsaQrz0kTuROvDafJ521yIarD8LqgMk+USQYlcsm8q3KAvt8J4gIEJiiMLjEUycbVqyFKKjSysSpkjtrixI+ZkY6Rk80MmIjqJFf7Vzx4yQnzPX4lzLLWsjqtXctYG/m7pknzvVoMCFPG1GfZxqWHuJaO9q3xpqNzFiuq5njYiOD2fd7QcyQoGr6gw3D4a81eNskSmM4ncsRJ9/7botZKrMkXPmzLFnhf33IyfwPfUzXPgAACMAQE1Js6UVCMyqa9fLj8v65mUcj0fQ/+f9nf/zzn/++X8HQ+qfWfhhAbRVKuR10ZrSJb4ND6xxl8jNykq8zbOL9UjQhiMl1pylkaHkf59LyTuZ9kvmmm9/yy/l3LcvzabBQM1BcAns+UoIAIh2EhAD3tjNhzVtjHkQM9MsdM6+FhQMJh04UbmCSl0DHFS+AqAL6gg2HWSYHEdoowrR2napzqOo0TcRxiHSWw2z2OZ0hRsEnXZcIKecEREkyfR5urjeNec4nS29PI+V3LY5mFpT5UnUgls61Kj56p0YHJFQxyXvvRGCklOkggfZbEhMmpdPz0gGrRbxeTzlCXvyPxc1CVXPEydEYKUYzXGZdyyVpDXtJloiNsPRccXOdZQDxOeobxcPW0zTL8aaFOwfrFrR9xcTc7oiahNpHOukWxsH+ulJrjxGRDVYiWnuFxwkIzFrzNs/dSUOz9K2sK8lLzo8KReseckeud3boX8OriAACPFJqs48mmiar//mc0XyM1evIZ5EX68jQ+0w0Uy2DCYsirhsKo0MVmoS4MpXPPMKMqqwbzUYZZGNCNbDUhRUFIeUwJnZVmFYC/ptHpZr1fgMzzVeLxukvZfCmZaqw+jr5QrVIlXDGFiKN9ILzHZiqKSqkaRwG0iXmI6jpVEDItoexhkCgqIyhEfChcKIg4UWZSaQAkKI0O4RdZNwOVABpK89S0RZOSFH8GtDbTkOFdkFeokuBwsi0LXK9blK3tR3Kd4hSCRcFXKdJHcZT9hRK8hyPL2zq8y0WhBeYSsen8AhQCkj/+9JkOgG31X5G2y9MYnAu+JAMI1heKfkbbL2UwZm+4ZRzFtCojQnElhOG8JyMUlUxwbASJIVSCRBChlUc7hATNIVBMMKELSX0PEAo0mDfSXLTKHBDYoRLSOwSORFweDRG0XOQfIvT8IgfLqIGh9RFI2XtGcQiXTqxXtqyNEymja+o1ow2kswSMkWYaSFZAea1AgRWXXNJonpGlUfUQLyEY21I6mk/pGnTbHkOKHB4y01QtYlM9QAaLWOOhpqzA6nMHuuhb52D8bagJUIpZeiuZSeCJRddVbRZlIznymhhgxUu4Ch4Kgh5cwTbGCGdfKrrDq5kRFg/yU08/+3di7Pr7NsC9oeVj5UfIgJASltpxlxypTkVMVQeN4/ApxytMuMwAtyPtBQ8AIirRzym4YaRICWMEImqHTyY4GDMyfZCYk+vSLrAv+mg0phzcF3R3S0VMyFtQhFGhSY9n6ELLGdyJeppaTh2NCdodgx0yq10pnbAp5y2HWnS6awKMEQ1cHslKhLgTIJisPRPsUyseOFk9Pr2LbY5ltMcKETYuQ5S3VjxC80+TVLrLOp3CQWEK9HFV/RFiitXAcJYtfh1MpOtXpT++bY51egr/OXIJc+Y0PNqjEmJezZE7e7BwmLEFW3FzWQKlVDJH/Wf29lM6esGZW93UUUnC2BnaoCFzEqWLV32Fz5gprYwmCyFyIBomXPZ0Qw9G0pVD2Tuhbzn4gsrfiV2VbUcadA//l4RNa2PQlGQY9Ua4wRbvEnqImOYXpVtDEF+Uifvob1UaC/3URMB3/5StqNFPKU+RvIJKr//ajEOfUS5Zm0+hf/oLChMz9AXQfVJyu2IlAcwiY0U8wMChQaDFYKGGnTgJQBSoYCM2ANKEQgWBHgytrBoQoq3BBwhZYVOShCzhQtlR7SoGNTKx45PUpZhQxljYOFygx1bdTkib25R1mYXuEKdPluKe71ONSpR0yNVcOyyfrG0nxG8oNll48yYK6fEJZtszBsexWJAWw658VUbTJ9VEZfs8cQRT2RCdgabLdjUel1Dxuh1ISxmqihM7cFZinVGbxIwyokwYUiiZ1+oy8ISIaZSgSomVzaUImbXaEqrU4xx7e6NuqmiQv/70GRogLcyfkdbT0xibi9odRTF4lzN+R+MvNPJsD1iABGbOWuonVSV0HlYIihGvnTuDPU1hSCrI0AgAA4sRSh0cNZGddz62Xxq9J3zVL2BcaVPakJKBkJcHmDkYaE5JH4dMkaYyD7zTi358Tt+JE9D//I2pl6ExoyyhzU53jZCMfQTUk7kKKbhxujMwZoRup9TiCiIXqp8inI3RXGImwW1Cert/HNACeblkhJVQA5kKBDAKHgNmNI8YWMc4KkLmKrKFycgMQARaqy8SwW0hz1g0NlBGgLogg31GWPKfUZ9oWp3BlYDc0lU+4rotpvo+M0sbAprncqk8lWyRGvNnWoBxvJVwkankf76y7PNLtTHRydMMNT7cWVVJCFBYnr9OSyM0NterurdOyo1QzrWWxZpt7HcwjOmcmWPYLRMTJoqOAqvlStQG5fMJ8Fg2EwOCOYgW5RknFnEMfD5IaJ1y8GUWOtJA7KtNJ0Ra4vm3cGkwMB8mdqsqiCxlFEbStzS6DrRWRgzrs85CoNQWHqtgRk+TLPIEqWYh5BhROBeYq92K9LSoQk7TPMEjZrDSZkDuNQ0WuHXn5fP//88fd//2L8v+X8EZGDbI+EqaULz9mYVFST9Q4umophq02ckdDh1sqTKYdcRao2itlpqeDzUxT+dzzctO91rjExJMccqmGEoygIoLjjJ7VQcGsQHhSwRGAQ5fJIAEKvUgpi1wVoScesFSrjyIKO1NnGorl/cyNplCEGTs31471aiWCU/FV4zqzlfbC5JpXLhGJyEzscRqSTU2Ihx2xl8YEMhu40NyfH+r4aXb9u6Tzw22C8cJH0saMwvIyo0oL6iNzBJlzmgOmK+YOG6NFlnm3iBau5dP3GkKA5xJXjXBkyrZIDHHiS4Z4ssS3rd7Fw24f1fs9O2S4ZoTFFg5c6ZgO4OYLqPFb4uNVb1dExFgyZh1v4EbectUjDFhOdbXz3tdYaq0h0ntFtmPDrEmn1FsAEABzD7FS6dGZnQxjpej935ZznZxgl1VXfoN6HGg53qgs+iVw4p3EUUBCDXUajF0kbU36vqYokqiaHFSsRGMXFBJjogiw0OeqwtkMT/xh9xZmytZ/hbaflL0Rn/+9JkpIAHbX7H3WXgAHFPiHWhFAD2+ikSmc0AAjjFI1cGgADkEA4KMOoZ/ORtzNGKhjPnNQbExWFKAAS0gCAQAY4TBngWkASM0wAycVjOxfM+k8EBoyeBjM4SMSgMxMCTB5IFgmZ9FBVJBg0GGgAGGCREvMOMMMmFRxhqhqQIOCBx5Rg1QMdFmuBmzkm+aAo0DzANSlAsyo8BDUjzOnQ0mDdhompnGwqkGmoOcCJcQjTBI0UxUqOGhQeAgBUUGWDGOWBV+Ys2VSJnRIwpFgpmi4YKAJYGihY2CALQDaShaKELzLCzFCxgWY9cbdWFwxpTYlPSCVtCxwyi0MGAZqAAYALoDhREcacbUga4OcCuZA4HSjVDjGjSQCsEQhV3CypSxXZhTgKEIroSx0W85Z9RS2aWYZ/Ga5UY4yOFhKWbUwICJahMFwlstBVjawteGE1GvuvFmZVVVHnZ24LbuBCW0T5LzFQG7yPKWicqcydrE1cpx0DrutC2Tr5a87sXW63N5XWceXtDqr+dybgFg3uDSQmPrkYSlJKCIE2sPrFa8qdRxm7ytdX9HXAVO2Nf1aIV2axtu+EMtMftVktgL///////+CpBONed6VN69TouI3W5LobZIo////////++S0YlJ2zthUTXy4K5mSQFD1I/rfgYAAAADoOGAgG33OGZwp70S+5rsRFscu0M8NReiQq8Vh5I/EO1uL2KGWLj6rVBFGglcXyWIKKULsMEQkDxweDzK8+JuSh00akxlCoNDxgeIba91bX9yv3xU8VEsRVJAxK2v////b7j7T/592h3WmpGlhi1//Fcf////eNE/+RTj/iv///72sOx8j7soz89e311bQABVDwWFNjYtAMjHiyYlJ3qKbBH40CGHmYoCiBUgWRa4XeNwM80h0GkQlOKIyzvydRPkgYCILemh5CzvSfGImjzSafUC2o2JgU43y5ubGf6EqhnhoUeBOz0R5ey9GQarO0uJxumVFkHfE8UDmnGBSPGGC8Uk6gw1zzPGya92ldYbILPfx/Ekqr9ticjzPWWZtiW3S88CFLLeBDtBgzP7voTer4VrZjyMEHFc6tH1ArBm9myLDna9xL2zAeTPq33Pv/70mRiAAdHdcpnZeACfOuJbOCgABwVozOtPNWB4TRm9CYbyCk8C0R16W186xFjw9arE1j5v4P3rWsY9Nw9/5t8bk1krB6f8sqcitZRACvyJMZG3rZl/nn/6mOO/ieqjjr+/4n6mneUmqiktCQ7u6u0xQVBuUYHYLzBQxxcQgaCgiWQFBHBvAgCY9RcXsgcWeMOQX3QzHo40YKDpqbSfnPcUMc+0JmTKjl2Gnq6dkIOF53mXiNMvSfOEDh9UgUAaJD2192/o/vmudqBRbkpFwMUrMMaGmJa8040DBjoCx4OBl4kkcwUGo6uSjml4IhqVaEtVRdIkDRCDipESWWTCS0afDGRPCZi3juLAltRkNiToUvnuLYThWosbw/G/cVxKMsZOxmKwUatCCCSKk6zsmJKm25bRTkXdYOhbXaUYB4DhFXHNBZOItT3Ua5OdtbGRzrO1vHq0W40UW5mQrruDlARrO9XsqkIHnKk2NIJzayBprnEfcKAJAqEBaHvmvilPpvSpCV6QVjEnB2sg1ODyUspIsgsDYotymPtdmsVsHaqexT4ef/9bkdXoIAALltMjqGqU292Qy/t/////6VT7UoTDCQh+EFYS1ZWHsuNrNHI1btEsKK0G7VSedBgJ9iqP5eWJzk4Vk8tHaAA7rnR1owFmpQyr1xqdQi+Qb0m7uRQ0iqNfFpKyWKY3T2ei/hGUso981s+Zsl6elE5tOYimnarK0AAAXuKCQBlY4YWNW6ADERljHnxAjAoEDSEozChiqRCFKhLEBYojEsKAgKR6HkcN5HsZekJJU1tx0oSiSWrlGnUwpBUnAn0lZlZFWPlRmkhjEXOEEZJKZrt5VDkkQ5djhUKdR8RTKLLagI1W2DCAQLBcSuLCuxCiRwRJuIm0OGgSXYqYyJZsrI2G4RVuAmE6pjB5Af8euSI32vHW2pI5kqFNFPVEjKUTsl5MxmchKlpNI1pTfDUtI9tAg5E311EswfP5uk820n3sUSCfM1sdq/G5f51bpo37krr3w3vgAIAacoTMz03MqyzMRv//819v///+RHDrDxYRLo4cOmyQmebFRMoAz2SiJxRRAUmAXAyx5H0sSEhy1ylLHHajGQge74l//vSZJKCBuhwSeNPTGJ0rRnNFSbxG13vI4yk3ongs6U0JI/QCX1vLLuao+S3xNRXebm0rMKtaMgxlK+L1E0/H4Fz2Lc4slK8VicGm+kKJpgqjL2aZWUM0JgDtMEQwRmZxBLCGGkUIsCYA4RMghTfNYlwWTJ7KRxYM3FuKQsCuG4zwtmqs5qZRtnMQhqfh2GZC+jtWnVfqAJTyJRakgF3cYZjUiuSmX8g+GqGcfxrSxnzf11b1nG7Tbt1o8QtuULkROB2gs8yquvqQXNpkCDtBIrABbaDzSJRoUuYQtI5PDBhSKJg09Qkxu21GFc7cwVGn6+ls9I88frkeVJD7p8HSs17fqy09IASCEJoJHQyQ+Fj2dxfeo2UYLa/ufxNd5QbG6itvGitQyWIJMmEgXs2k0CU4mKYMPSR2chQR2Rltu22yFPa7zK23/+39NEdSqAjHAUYIsK6ympJc8QkKiJZPySRLJoVFyVfUriyhj7WVisuSsUrk0qehcSihtZtqmrWhf1WWjIfZylUPm3Qwpm512wz6P8HY9yNxmkIWoTVjeIrGdVtALTiIBCBBIjEGEQFUABQQKZVRhCFYohBJBxglIJBsiHaAkOXUO4cKiP441Ye6GF1M9Is8NzQpsYyYCtPwXPCrL4N8jBKZDyJpAZ3NWuCjLauqJA+FY7V8RVRYENs6HWFG2AyHaIhYMht5VMP7gygRntEoYOjECUoTtkqAjJmFXCAPYuZbKro1jzaEmVHyYuq4KKrzWTLuabKIWJG1l1jLfMqM4vFFSZ39C2OzUZuOmCVLcMQXLHpPk2dUdSGmUqJSxlttJSyVGRvEqtH3XHZzeHyRJRYSIt2CpkhZUeVgsojmx4rsIYqSgUgmhGjgFA4pj3M9kQHPdmaCHXOItHi33Mjyrdtaqh2HqZXcs6MqND5owbCkMBBMMBARmV6JLdHpAMqrUP5sdVQKN/sd/aKqhgGMxZrs1DZ3KQGRk1c+IzFZChYOlThbXLyz5SbIsjzzck0UtazNMyDYoKlMYTeICAFFY5JA34Qwxo2Q0wYMy40RHmVGLLAkSaQSDQqsgYCMELYaiMeBKCHjDaEJVBNTJJillAhwspcxamcwkQc71T/+9Jk0AC3Y35HWy9L4m+vWLAEQ6BhTf0ZdaeAAgA9IhaMYAGqM5tyKUehcJJHHirj/boEZxYVE3KVXIYhzAtx6olOpc/EhBPJpYGlRvUUnFS1trVEWUozoqMztLK7dr6KjTp2it1O5MKBcFQzP1YywI7gpnG7W3dkdtcaEq5Y0ja2zPm5TPbtze/7+aHWR/4enB5ZU6Z4KxhVssF26XDCqYG1KxrNasUrXHdNDm+XUdg22odAev0Ms9u+iwYzPFYYzPRUsahdtWXN5B9FdRvZpYs7ZqDlkWklAX3t0jtXa7DRDmxjzEw3O5dIPJB7J6nUxGY/tKvVFPp+FO+ylhsxe66Ks8Xv3PHic1zce2q68xh8NtRr+s7GfNQraHbk/pPPlvTfKbcftMHZ/X+t+837v2rN1977m5vzdi/Of1Fy+Rfn+u1yn/93DGzcaWUdv9c/fjXueoYgY2dXl79M/e58bfpNKuZuGoXsV0pgBgCgCVJzByDkYjkVDsWEGiCYsgkBgYMYTXC6VG+FXmIwAGHoRmeo2m+zcFHaGdyBmFoUEQRmqRsCRKGC4lGRI5GPBQYYDx5CxG2DGFgCGOcwYEAcJAMDzWJ5M8C80eowxfjw6MQi2nMJARkkBmVQ2Z7Wprk5lUIGVC+ZBEoWF5hAd10N4fMLgVxDU6JMlgAx8JiI3mFhEJB8xATSUejRdEARjrBnJT7ZO3Iw4ADEYHFAoYyDQ0gzEgmMGBoySHTAAPBRBHhGxFAxVQDARkiXCCdiZMATLRYBxwMJgsKi0xmDTAAEMQiABAYxeJQuEy8bVRCC2n5xO/SyOeuw+NEcwcHAMKC3690AA0HzAQQCAwTCQOCiRaGKSqq7LVLGTWm7KkaYw+Bku3Ihx3Jal4DQ6YpB4gDIYOzBgGEhEYMBDNVylo31XOVQS/i53VbHUl2qWfifLN/7W6axOYXbE28RhUBqyN4zkCgNX4GAcHs7AwgQbT7gotI6rSVhYclF9/ZLEZdUo5yA5n/3/6/muY//6////////+9KXLrSKZful7bcSvlL5XP////////1orGbkppatfCNarxnGGpcQAQAoBABIAwBAMBAMBAGB6xIJ6A2VeqFs5DeLf/70mTsgA3nik3+d4AAt6qZf8e8AB1xo0e9l4ABrqglp5jQAKkXycYI7SLeHOwQX9BZBfH5em3JC1eWwua3Gsq56v7QoLBBZ8Ky8sk9NQotKsk8KJEfwb5zHf4gsalhqPwZ/8U3mVnln3lFPVHeNEXbSoHOPEpCUmcZrmen1Pm3tdn3aeHdTqu/9L71h5veL/Fs0ljbnr/XW8/Xu/3TMcsoAOSJAjEJdbQieHFRRsV0LADvlFFT7ITaz90WMgJpZOPOIAAAAJXijBVJOSUM5PWQygjJWAKBt4Ew5hsE2RlEmEOVhKYKOGSEC9IKPloOckrEawGYFKJqiQTQAOFeEKLuMFgB8AxibiFBdEiAehDhFS2pBbTxlHcqgfRHE5NVPEGSRIhXi9lS+P8yyCi4hKSWqFIEyHEeDhlwbzCmPRVrbaoDqgvsqZVJ1MTqN6wMhynMaz1IJxC5Fy3xFacqIWrVfWvuNrLFP4P07knP1QtSqcoU+M+rVPpiszRnyee0rS9mKu30j5mj421wZ4cJVPaqkvrpPM2H0l/GYsQYmI+m15dSsrYrrbnlpNUAQJAAAYpCClNdcMvnLH88tPBMNlMtCnWpELqN0KwhJP/WHpJvUk6SxE/6BoiKJmZonTAW60BsKTukOARolxzooojtHpRWgeM1NrWYkD/9RCLht+pPOl58omD53/8u62UfXvKvPqfpw7y2sO1WFVBAAAAB3i0ZAwdERwpGdUY7JtqAAo25Ad0AW0SQiVYUIFLRCwVVXbU1yq9YkumSHDlC6Nc1SCkQe5pkqNp03sxVEGPc93YM1PiTC7Gii4gXSGDjLeLUK0VgruDmC+CBh1EeXkCZFxOIhAbZGkooiFKNjT7IrVkcxMDorGK4/LhDRojU+PU4ToTpTKxEXJRyLI5ZFT8t8fwLdaEI6QkNDNKoUT2Np3UzC2iG1ddGygI2gqvnHkSc5deVOrI3mbdLMdz2p8XW41ikXQaXViDN4GVMbMRd6CIdkfPsu1R3uw1EtAI1AIAAADe7RSRR96brFQVwb8RTxY0SNJznPr/U77/0OwUcPRVsYd9RgkHjdRovoEUQfU4Gcsl2+1CmH/mwpehjdTSk0/ZV4FfX//vSZJaCJxZoz2svZGBXrOmtDKKcHEWjM0y9OsGNGKWcYJmIcG1hyeQidBK/61PqFJ9LMAClAXh0bj/ABJOdEwWDlOJtTSSHARGqEBCQBlhJBLwQxQdTBQ4N8EGtabZeasFG0pp6eqcihy3pYpZD6ymWO8/6KUWeRW5MaSpes1eB+n1QdWKuWgZyUkgWy8H67V5NGkSIC0KeHSK8K0fKlKI812iTtOdteos5X7OWhqKUXqpmmNCRdKI2TlTpfD8REimdK/aeRsFco27HBzeLlRsOET2SF6wWQLIj6Y7UPmLPZgwFlyyjZ1tOCrCMhtqk5tKnYLZWQFRNYaSOdqbjiCkCEybV8WWiyypKfQl1CzLZtVKoMAKVAshh6+MzGiIojRpU0Da5GyROzQKTD4TuE1HfPpdTmGbzjzPJaaRoCJkiZvSsqOSMhmLg9tW7mpe8dnSBxoGCbXtJ0iNJOCx9s7oQCoJG3T6GknKJ4NWl49blPxIVcxoxTEGAAUAAACpTJxIwlGNeJzoRw6wqPDZz6KY7U9OKKh7JDNozwXMjMDECkVGjAw0xoABxOHA6IIjBEtWKvirYich1f9tVLr7cgUAo3LPQdTeW2iSqhC44ylljSzyPRHqQ+xgogveD8Q4kSHk1FxcJ1ASIZIXpwPDlT3jOIuKdHyLadJol+JcUp8HcI8OI0lO5Giro8KOoWVGqEujoyTQlCURSwIT3wjiTX4cj1MTicfrYEj6YyfEqzKhqh8vZrbkmNXciXWgLsUCETTl3kJ3VV1EZjrsql0UVm1CYjr3y0YPYqeiWpSo6gE6BSrf0xrpOOkhzYdWE8H/+fAAACdlQlHgiHyxUzrTlFaasyhjXpQCcyC6gAMSLG6wYMh6sh1WSxYbos96yu4hm+KsqBRK0BoouHxMUEgdNPSIQFLh0KyQSDpiEN9wdkk7bGrylxMUDkDPHsDJY4NGCa0KA1GuOJgqEHexryGYOFm4Y4duGLkBkx2gMMIKy5o0FFY4YaFFwQMKpghANMg4JXkXSVK4SgbdaB50PGjv0UDVH+L0NSeg1lgHyFoS6FloT2CLiuS2M8BtNsqWVLn4MsvL8om9jC9VkxZJZqLsQtDzpG4T/+9Jk5YLnvmjL029mMGCGSVMkI2AhOfsizb01wie+YwDDCyG6q6L+KHSHpgBRLy9JchHSUx/MShaGdyZi6JR4XYgzwky2sv2RTuNjeyoIcazUzIJqnYFapS/NauePsRqLNGRVzsDG1Om5CqGxKjJCNUoiRSIjhxskbNNH0bJIj0biMKiZAlGJKjEwoxEiW5KFjZPQpFEDEyij1TDJsUnwVZjuRYOlNjVJpSdK0eOh8d4dND/B/t3r4tj7CUrB8c4JIwiJNhxPWo7GK2rzS6FZlmL9rUr1p6cnu6VeTXfaXK12xJJ3pdyRPrzSZHZNCSRI2zkXXJB2qUvJTXr7sOarZijqZeT2o5I3H8o5ju5WJmM10f72VV9E7999tNmfyqfW7rdH6so7SIyLFXjMQdjhQoxyHBB0AgbxnDoww7hCHMRgccq2IE4AADvvgDCNidMcWAV0xIgmWGcRjyw2Jg2Y0woUaYq2A0iPBAMjLA9d7DUjHwEAdB0mANKAYXpnBxQTFCSDeDWENAeDyMU1wMaMKRCU4uS6jCNFaWQkwigfI7wWo0iRhglsYMn8EpTgszMhBunsO4eSuEAIEMI5EeZLO5SF/J2GQp1OXswxu0P9Wn8lDSPcuLar1VASaDU7IwvlbaZmnSj6z9TqAqZJdLCgjIvIvIJFVkezIGIKkJ0oFjyHCyhAXK22TOeLSH+oJm4RWFLZtk4NLhiCqUFl0CMPiiK0ECtyKH3Ay4FhiRUjtoMpkiNA/EipOLjY5IpQoFVvJCqElZrZqLEgXs9cyeCFRRGYQIEIpRSAgAACGD+agUCqoOkRlM5Pp/+kipTJtUaCxlOlBuVvf90kDOktKCj46bCwOfaayoBUxJOr2ZzFhkWakEMYwSGEYI6hhza21ilI2kk9JsXTj/1zP9v//z8j/Izh1ER0lxrIkLchZh4RbQEcBlIroeFZUBzGWXWG/cLiPB0pHa9HGkZhbJLbTqg61GwRkQMIDEAU5IY0iMGnQdMETYx5YwZssgHOCoDSvAhIOIrJAIJXCmixkhlUo6vlMV1HUThQ+f+2xDoRw5SDDnJKMIFo9IcW0hJKj3H4WIo0NLAo9niUArh/GCpCkXR3HuPc4f/70mT/g7iaf0bDT0zwiY+YlRhm+GGB+xkNPZUSKT5iQJEZuSTloSxDKtytRQcxtmA0qcfqmTAiHZdE4rKhsUwWRHYvMFZZUmyhodRAZP1TSUOUZFu9JysqpLh6sJdlyY7W0TetTEo0i5pSeuKqLTmSYgUIjCo3+bnnnqtUvPTrzhcvSkwxcs0crzGeOrPmalaTjoerJMLq6Bl8mJOO0JanXKnDmT+w2QyKuOGFTEx3MqnZaTurqVhO1hOE6AqutGLi48YPYhKSNwrElDaFBx5n8gmn4P2sAH6I7wRDN2bB0JvjolDDnbNDE2iXXv82CqwgcYq1IQ5jJw9IpIFIbB+FmkjmPT1ZjrH22chm8qd8WVn6zI/vbdkES1WzKiI8NGsQdkIMZsISeThjb/X6vKKIe2MLe/J5ds7KvIMIYzIShMbcUTJ323Tz7Lvc5RCCEKKY02vrOm2QUwjAADHGDHSDksAVGGG0qMeINYaMiiAyciXLxLVAZWMhy8paIlBszXERBkAI+T2J8batiE/MUJEWAW4W9AkpMUvJ6mmhhbk+dSnPNzV6MQkzEa3iKEvJecRfyJYIqyxDbjMaElIiksdiEN0U5WdVQ3rIyRJhLPQaphBL6KJ05oP5YHGq1YQo+EAyNSrZo66MsHx+2sfOqFiEYr7nWrU6JJCmWGMdjapcWn8EnvJ0JVsDhw8sO1kT6x5Miqn1qlT8/fOi06fcveKx2hFRcJcn7qxEyWqNUfOqsrnrHaJpZ6lUfyX+KymjnFo/JD6s0JJ/ddQgWM3Eym7LJLsmZTwGK7y5S9IsBCBgYArLACTAoIxkY3Khgn52l/mVRd/z9y3bNbXtYZcKKu9dsQvZMJl4gWiZGCY2YgRB95k6D1lBORXBUkFoBCdSSQKcD7Qv909/z6/EUiMikL3WlLa+nz62YJeDUQPRJ9mC99d9/KzjcS8HkyqaOIGdVIZmxDGNLG9HG7gHFFCYICtIwj0CC44LFg5IcSuVkLAwIEr/dSzcUSBLg3m4qlaHMMMnpY1oM09kECbJgZCFnkh9FKc51k9WEuhR86RaiMd4eRTOSHGkfpoobNVCZyErlCijRI7CVHC/jqwGsRgZIIzOh7JR//vSZPYDCCh+xkNPZGBt7JkMBMPiYsH5FQ09kYo+v2LcM5ooqKTyFeL0xHK5iIJNPDlDJgnF4qOLrlpDOBBJ7jR4Wx5WI41xLZhuR0sKtKWD1eVxzKjheEK78ZdBoPglqHSHUSkRwW0ZmbQII4GJdbIp2ZHykkiGVxUoNl5TTJT5oS2F6VSV7CXGcrR3PEFgdigft1HSwiqEBlGqPCoKFKGlHKTBQXCzAcrV6EcOWbLpSMi2mM1jKGVCerfyrCGtGgQFAAAAiMGooMOhGVLXBE2jvs5q7pbd+FyFz/+zo183/uOpgYKFDl+xaRaJEGPyICyEwako8tjwhNLEseiR8q3zHxmIPqcQCglUwpLYfDDqLZkmxbzpt61PruRS10yofAJURRJL8i0/sx1GpVRxL7LpUdyVJXN4bnpiVc6rxzkqh60lSTffma7JlI0vaenL2gu/RAA+IwtE64GWOksueANDC9EBbUjEnLwoARVZVQaGL6KXDiIeMAN4BYQC6YSUgQX8pjrstp/BRpoh6MmISdi6ViTY2169PCjSp1ZqQahkn8qzOZI5bE6bqyxOAQEAjlRkQwxHskDoSUIsGRmFKFpbMzsJkRwdEod6FhUWRMKgzJbJeEUoE8qMFjxGL4iUgL5cL45l5xEXTBKS6Em6VwSbmIiiSfodXkQNFxy+aFc7XMD2bFZkRi4pL683fPSYXxFLQntoRcLxcMiCwgZcnsiA4oRFYdjsT0woaQDlk7HmQ8UcQVpuaFc+EA0VmK8zHbIKkhw6Oi8tbTiKOkBYHk4WFxKQh3D31xdOhKIpbWHCwkmCdK94cCxhcgWEqyR1NteL0iFGhbBKOhG9ZRY0tsaaZmIQvs5kBQ4Nx4n8s2S2jkkjrIyR+EMDJJqVta8JfKx6MCvJ1HikjpKBubCSKqtlTNsRyLV5V1uii4G5eHoUyO0c+6qZ2epn8SU1SzYjflpdGudRKcPQnY8n+ire2Kv1GVeNemslsI4Sm7yISCtxCBkZJAwCCghHogcDrBwtlYGeMVoEBh2AZoc45CC7MVXIDB1j21K2IjfcyqO1scSUMxzhkGWOQZ5/vkUZKRLi9N5PsNUg7OFdRZj8Mw2huo56wD3/+9Jk+YP4rX9FQy9j4IpvyHAMRrZh7fkUjL2Ryg23IYAwmcEucGLZzJdYv53oW4RYMA5iXlhOOCdJ+qSOoWMvzudPqBeRh1K1GEgjqO5iT05wSzdScB6XjP3B+bOvSnL5UKbRu2tLysfGD1CDM+Ox5XnBLXBK2YLRiTF56JyJOsOyaYciOCe6QVoiLUMuUW3cYSjnQjpFJeVNFQenURLCizBbSJGDNQTVdie2yJheqaoIkIlg+IltCouQjc8RYJZLEt0uQl83SoJwPbh0uMjQSFFhwxCLQ9mZuvqQ2CcvxGKGBGMAuZp/bQSNVMPi1agdWlx02RLY8nWa0zbbFzM11TFa9ZCaEHdUTEbNKrJa651KxhpuPbLOd5q0XX33H2qbpFXXLIY1UrGd3A1zHMyq1sR6DTMVXiM3a0mkS3UneKjWe88TePFzNrr5f5eUlsbeIROVjeMPMZ0HYtBoPco2G2WZwgQWYUAICllD4ANIaOMRhh4nkEZISgCaLCi2iEC3nljSRZ5CekGNYwjzyLeIYoT1F8aKFCSj8JGXU5TeUZtiNIchJxphIpY/DIybBgO4BKzsVzKdzYTovidS5zKxwRyKNVGaYtEHJofK8nEopkoGxmSzgDpiPWFRJ5LKRbEGItieJQoJTRoBx0TjFBO0qk9UAeKcB60JQ8EFMSXx2LAuHoiL7rC2IiIdxuYFo1IPoxy86JZeLROgLQlYJZbdNg4gWnpkPg4LRieNKyc6Li4BofTxvxxRMcXyWZaPhUQg+RNlUfR+XHGnvDukX0MaQXMLum5CqubisPCGIbhUMTc+Sqj3yzATCwPTpZPDoWmqZe9L7vn7YBBAIAZ1HQRTCqzczuyc/x6T/iecv+Z5BiDWXWr/onx2qPcoawCAgTWigzOEErnsxedq1Qwga1oRCSLUwZEmG5MwcoxN2nujsSMLZQ/GWsqmDY3nR3plFhmk6tVo6N1ta9bHSnDt1roldXG9i+X8eHJ3Ea7W3YwnG0+b8d935uGoOZWfIYPwiHJJAxOIFRGgcNCELJgghUEumZp4BRKghgGCIRKyKEAZdSIqnfclpkszYTqc4lBlwZTifD2RquJTHJ+W81k8nJkszNCUbv/70mTwARibfsUjL2PwhE9YeBhmvl+1+RkMvZFJ+r6hgFMXmUeUJfoo/jFR6dor1Ojm9RRVTp0YHbGCQTCUYj4eiCbQsk+pcQDeAXHqo8OCwkQ0/kwolU3aLxg+OaUnoRdSk0mvKsOSqdHrkTjEJMXLCQWOPhHWLufUm1iWTufTpUhTqdiuNmE+M/SD4fpoUx0Vo7HkB5hMmCBLNSOyIxIgWNsnKupeYbqh0Q4EZM5C46VpUIc+aTRH6Vtix1y2OVS9c8fUJZVSoziik5PVmHdqFWK0SeqGuhWBxouPDgoFuNOc6MJogjRvFBIkV+lzndxuinehFIO6olbmEfTIDICFHn2b0t7oYVtf/zMthzw+tETm27Y572xhsT2RYtDwpzf/aayw/Qd11OJkyB9Vdl26FZtkMNH2OnIgs9BAhQQIiwqz8Vufzh8mifI415CE6sPeMoRucoutVEkQADaKjNhRa6FxQQVFxRk2RxwbxGdCGKBCQQWFGUGiEElqlcOClr2kum8QjMABR0YmoZesLVlChciTWaysMXMKARcBW5L1lS5VlFgKStULs5FkgZcQgTEP4mRCyIJFFOUKCOAtro/lAX1WIUY8U3nNGivHUTGE+QBcVOoEOLid+Fgn0Um0BgjjIeKDkokLR5QjM/IJgWE1TQPTtDQS/RSQjs0WkpsSh/swU0IxKSRAOlon+B64iJWhBgZWE6RrPlhJeUIaZavPA6PCYUmC8nJETpscHp2OQcEBafCQtsJR+p1ImNNEVsyOzgRKVSqWCU6Po7nQ6K1tl5MMVqRSkHFUeZVGdm0Ccpl5dBCriM0J8Q1Z6yNb5Md9CePjjMLcaiiODYCdMKRzdXf//vPH/wHA8hHTguZUmi4KxqpmNbCiaNRJAsND5zTU3PGvwL//MGpI+pITKpu9I6INxG6zVSDVFOWQLopM57yuxsSoOZmtPBhg6BTLwwvh6hhODh5CYLVWzRWpktNl1C3HUzUITmKRc1FKCgqWG8NncY2omh3doewZjCgAU6XACGYDZhHFD5CGFGTIJTgEIMYQRw23gJAaapmTBg0QLxgFaW09VghivFxBEkZiCcDAFgflMTNHFxJmdJADpIM4qROG//vSZPYDePZ+RUNPZjKAL8hwIEPwI8X9Ewy9kYHvOGFUYRvZiyIcrYC4S52uTIN8nr9nSKhQhZL6JkaqGIzN0NZmlYQtIGZUPx/B8fCqwLQkNg7H9OjoRx5EMmA3JRYJY6HZsC5bdHZtUJ4pH1YqNj4njiaiEHhUOL2H4tDySlYZ84B4dCY+wIJqVSGcHSRSiKI9i0cFykSBoEU/Kw4Npz0PTip3GIOwCMdrDQlnQ/mR6vJhLE9YaKDwEn5Vj1GOwnlkQz6E1Xn5LbNk8KVKPglIRotWKHBzKxlw4JxuQrnY505fU/jBqYmJwRIFI9IlLIlltt8JMieFJzHLpFtd8qGp/3opSdup6vtjnPPzzXZfmZ6H+lGLLlV5+wgN9X21p3Ecmk7nehG7A0b1PzKBhwbylO6BBmac5S9kc9ehAbIAMCqDVGgw/xN1i+YZ+8L79mtO2Loqm7Omn18migoO/+dl2QKb9nJU8ICh/RX4goyVRUSbRIQGYWmSemhLgoeb6YAT5kSRRgM29MY3B1ovKJJzKgBgyEFgEVTCFhYiFEIMZAMzDgcbX8GIAWF1lwJQ0MGAYy05Q1r7/KWMfiU8pQyla8t0sO2J8oFbLMRSKQxLXDdB6YmwNjzH2GRGDEqS9RuU3N0EGEtUal+NDR8LhjIFQrsjigid66lILYYiDlg0KwUCresxd1JqJK2M5X8zhrd5+67+UUzp438diUQ3POtYZOAmTiRQAoAAfCYYJE6cFQPiRojJPALiZIWBIQ6hQtYPsiGRjiQ3IVQOnBK0QEZQdMDYFiQhIhuj5aa42yTqhVATl5iXBMeFZAm2iEawsKirCjc2TaiTzZCjQLClXG4tI7Yxd1FDoYR484yshTRqhg8G2DKwCAwABRc8BFNE1fTR9TnoccyMm3R7oM/9NlIOOTGR5+4BCMix9SdwMEMHdxLtXdHAEU77xD68oQvrmD8xgiAoxZA/+8L4P8peiH/W/5J7tRe6O+Yz1FNVQ8ndb7y3iG8zdEZ29k3dQbuGFxA5A7RAAsSAk5knI2zMCnMHSArkiUGDaCQUebGAMrKZ4YYmhOL5BQG3MSCAUgIQacipqa+2ZW2aYHDYk5lK1RAguMz/+9Bk6YEZLX7GW1hM8GwuiKYUYtwj/fcbDWGTwb2m4+BQowjZejOEp6RuDbpqZL+Wi04vWpW8Sw8OS5OKOsRhpfCT7qoHigGcj5iZKKSRpfxKpdLsM5ae8iwzgtq2BypE4EPxGLRq0rCxpf7MGDMzcVbDYorIZ1SmQIVO7FGKqoWWCuPXmajLp1pjoQBK4eENeel5cGISCWDpaAeUyyVA6QB2OxxP3yFCYE5iiCU1C565MJsZnqGaFIxMCa6bqmYiMVV6HXD49Olrhk1AZOnCMxRFSvJLnLCG43y1h9x9WWywlxrilBC7ihYcUu4l9KrWZc705okrdfiyU7qfdgoXanMQBcEAc6g5xhWSvXXY7vs6K99F0FE/43uNm1UN4ftNBRKGCrCRafccY56ZIxBTsOAWEuehEw8SMQ0R90nfQYKGnjCBQQB0aXu/cy/DvdM8mI4HwIGlm4YQwnAA0WuYtGUHnlHyoP1CJBwgzcRJh9fpQMwAAAaIcRQnyu0FTnLWaJ5jtg1Q1T1rqcjx4OBVlZczlPVgisCpFB3PctI1325MILOLArjUVYIxGbJFgYKsbvhQiYqzy6IgEBqiNqE4uSRHVhUrFqgE78FzGttdh5GtHu69YjgMoSVLwr5RGLlp+stj0ceNfUDuy06G1jvw9qfL0va5K4V1O6re5Smr2PVNOm+0nlSxWsqlh1XL4OnQQZFc6FhsOui01TWXQqHbK32Xnnh/FoNR1CCAcTkklY7RTAZllaRHFawkNHpikghEnD5c83GubyCWmj6X8Ty/rJ0dVOUSCwngaRK4T1S7A40S/bQ+hj1KfRGj7NLNwmCzV0lk8WXeRYhOJH48jPeMb0P0Tzq3FeNqPtD6QCzIkgAAAVCfZDdyxP6PZE1yz/PKP/p8fMtX5Q2sn4Tg03O25p6UQB+S2NRzY4zpOZ66auvxRC0NkrRAXzULb1FVoxigFhPN/fs2sZNJ28wKzKpIdaKAoW1c2eExY+wdPImz7rSJ+mXHBdxRSxwwv8bD2I/lK92R+XM34TfcdxCp3/9UbfKHhRU6ZbmEwJkZSFABcAACp9OwJGHNLjBaiGSbwWeUFh5JNGd+X7XBE0+mLKrKVwA3//vSZOiDCNJ+RsM4ZPCDatk9DCluXHH5Hwww3InaNKW0MJm4FZNtpqb6U8OqQlTftkXymUj64qA9gCtTGoGXlDzzy1AU+6nSKq01CYFhppTdok3EokwpjM3UKzs2RtExOkfEwnItXrTgPzEThmTYFRwOxdXKj5ZEimjnN8awsHLDKVMmgm4ucPNIMuW46FBlKNnIPkFLbned+IoEypnS055xy2bRVptWfSqs6ZjcpRtsRmQ+ImNm09IVGt3Me2dTEyKmOtE5jzMLI5KzuUyFSazGwasmppqs0UEUpIZ2xoo5l0wv2/Pvi5Mv+Rf/7v75coIA72sODJYN4bpJkcNaVUkV0YlATTNBek8lGSr1iW1ZtEbRwupZPvL9NHEArZouyRALO0gmUakefj4yVmJkSCi2pPNok1cUggev4XsgyIqcIpTD3ajCs/V/WgJUAAA6iUwys0CcZNmfuFwjOqAsXGqKXgXEioYyYFwwUZQSJ5CEMkgttTFMx6GEQQut5V9oTJhIlDgn0VibRnoNyvFfjHgcF10ZVZkEyXqGKrFBhoTqxKqnKXKYEXdLUpfL5UBjD0zyWDTUZnGS2Xs5TfRqQL/dF/YHgVn8J5OZPfhE1sMFZtLH9iEVa65D6O2aBV4qIATlYrj4JKwPi8DJ4DbTA0tlYiw0AowKEEeYi3gkjpEOxJMIGjCp47JISkcd0IqjkV2TWN5AEh9GvVHhDahKcB7y+UM6aRKJYHQzO18Sskj0ydD+tNILICl1bEfrbIbqnSnFctnxIUrGCaPrZ1p2vNi+kQI6Er1GoZ+qSxqFjbkFrGiJUZY8zHiyD1EgAY4ALMqkDnIY92RrJSnajtyJqqr6Jfyev7z15ERETKsjpKOILQwxTROARaDDB50DGuSQUdFkKjaqlW21lofE2ML5Q2zWIHqU+HustCmOrmFqse+UxdZ9YkdBbm00paswrEtTSX0sWcZp8Yb5ox/3ZzmRxTTvi4XUnZRak1xLlyhWpG7MH+227qWNauROFkFYgnSDsDNtNIQO9X0cR6XxjrgAtNwajfxPF3nYeVyku2xN4Mgh+oUh44VMWMqRTifCFCFAbQDECweIRrh8kLM4JCJ+J4QUYpn/+9Jk/IMI9H5Ew1hkcJFvyPgJJuRikf0TDL2Rwjc+Y/AmG4mjmOUhxuKg5B8laHWbgaomopY/SEkuQp4oyUhVJxoJc8ue6hgtwlELcVKfjCZqfRrpNizK9CZFcxvHV0IZlTUEmIJiERTNSSYnbpAJ6YswkSNYhF8dzE5tAIkTC8vH7Jm+QFUbZAUkxfbjUmE07GbkK4oWUEw6dKC6IpnRuuQiIOUJdqXl7qczsuQj+FpYatYWI1xSPzYSXSSXT9GrTLiU1EyilYkgXpOQk7BTHM0TviH0aEkQzYzWJhASqzBYTGThXq4pIRTXHpwoYoSQVUEIAAQIMeHE0dTMKElSRe6ui+krEWlL9K7d//zM/PLvPlO3FWr7u2jbWk/qs3RdFVcWnMsyF4slNUWvUkpiISuAPDCj0LNfuJQBi5c52MIHpdkZWlhqrIqBelJaNDLBUtNkZULRvZ6XX/PJVOpa26zSwGh5fJjZaknanyvTP/m1SXqpJfN9ZtfSS4NVEYEQADLGEBS2jCdOGMePNQI1mDKtJjQcuZ5o0MwBYRh7vq1AHgDRlFpAzyhE/HCMBQkhbDcU6ON4koCKLcdK2LSrWg4R1HUWITVcKV6bMFSCEzCwp8mhfapxUlsLGhxdXx+nmypJrNU3y+vG1Kna5nLIc50mCb6dOEx1acj5CzuMlME9VSrL2zJRESoh0ljmRDCkjdQCoR0BgJk6ZnrK2o1Oqhnh3fI9vOxJvZTvOd4/Y4rVaIoTzX0+rkYyMrOxtasb2ZziK46znMKaE2o5ELauRLQyNEN80LSrYDzhpiSVhbFC8pMfEVpftiqcX7em7LEFsVTCqWidnYU830VkZmK1miJfangTOCcUT1WPoZc0Lmnev3TaZLZPEOQ6Gx7GUEB1mgBUcWdpGpBnrR0rf9NHdP6Uv+9/allzo/aUqGRCFKqs5QEQBDhgogahjGcoxqGKQVd0NlZDF2MroFBODugIeIQ2GhYqGpomlqITW4d+3iV3GsWnSm3rl5Z6alABADAHEJIDAKQgIBAMBCDA1BYGBAzCfHwM+pV4x4lPjaBKDMIUAUwYwDzXsOGOBFUcz4i+TIqGxMFwFowLQPzLFBlMQwLwy//70mTjAAkGfsVFZeACXUkI+KEIAD6OKSv57gAC+sNldx7QAfkETEyEnMvlUx0MjKT4NXA82FRTY5uBo1NPBwwuiDYZzOmOA0gGTNoHNV1s6aeAENDCgAQnuQaJN5yROGKACVgEWUxt8iGqTQaCUxgUAopA4CGFAAscxkkjXRmMZkM2kPDJaJMyhciz5iE9GUggZfB1aKydpjSGamVQuYRDYsI3hMzDYhB5jElGMC8aHQRmlJiAYGTEkqcwOA2jMEWZEY6k4Y9Bac5gkCmMggsRAAZPRwyVzMAfNLE8zOQgCNDAQKdBnDYopHW7RnbXBgHAoUAIBoAUW16GHReY1E4KE4VFYFAphUKCgnBR5MSC0AgQSBZIH00nCawmrXR3gd31JRhdo0BAaCzC4HMQARljLEw050B5gICGCAQo4YXARfkWAQyDEelbUxi/yxEBVJelre3Z2H7dye5G69NSCQEZUrBF0MCzgQBAEFy1YYBzCQETogQv+BgG8CwQJAgJAy/S/KE1uDdqZLVWFCaypyuaw/PvcMdav17d/////////2DloEHFcIbyOH4NYnI0iGSPwsdt5f////////IloMmnX1WBSFj0PMigF8nZwfVhrAgAAAEA4HAIBAQAAID8FIrjuKABDLYxHIdYRktzPg40LX2KxsaJjuOlyiSBqTys6ZgO8CfKJfJhkslx7D2JgsQcQAMB1MCweBRzw5lzOt0E1LNR6GiaROY6FzOgTOeWmim5gTyTOLL5TDOFUHCO8ehJFLS2bToG8vPTL5TSNJImDG3/9PoId0zFRodTNaDU+m6k3f0jGms68wLjq1cumD1KNlIH1HdW+3//9lm58uNo000zn/+y0kDU+5QwkQxCAAAAJhiVYdCbGeL5UHzZagxM9C7uc1jnrT5tLkcyBAwlXaYohmAi5qYWgjNQBhb4IELIANEKJlQk23Qe4Yhhx1G/gaKI0aIAhPE8EDXeA5x7BnICIHzfqM1A0zAF8cMZqGj05x3G+MIRlckIrGAcwDClVhGwSDhyYJFAy49qpqGCKIpJmAIMkFzhLc9yjjOT8cAsEAUwtU8y7i3b+tIUwWgjrIrBe+UwWCmUJz9tIewOFR5f//vSZFqCKg1xTD9vIABYpomm4xQAJoGhK01l8cFUk+bcMw2JtuaHIRAoQLBpIwwx9LelfpuEPs5ikKd2T1Gss6izpOFCXRjrmv5JaZtlglVmnO068MvhDcDRepHIKprUMQE15voelVLLHwj8jjsqdqVRyLV5dDVvfHFsU+3jjr3SVlTbNbevNYZ2octu3Nxus+kXiTUo0rdLoGv9gXNzpFL6r+Pt8IlP/////////+7YBAAAPpaNDhGpw6h4eQ+EsMynRsgu6UIzBFtfRyNk3ac9gi6HQmwEUOHFw4UGCBkDpxQBi40JODj+nysKkkOqlxgv1ntTXzP/86sTiVpEgtB+BCMVkg7/icCQAACoe88bZsCYx6wgPoiOoNaR8kc4cCoxKeNsrNgrEC06i8a2mhWHjpHufmgXmYQG1ZHu4LJgb0taZZRCyLAijyOZQeZpIgcNNo0YjOMNtw6Vi/AXAMdA1SgCGLXFzzOVQQBVhSgiLNRsFcgAUAiP8X/UKiZkzEKBlzGegDjQcEIwBxJNov+AETMFLSs/VpUIb5hhfIKgF7k8oyo8WWacpaiakS8jGX3XStV3ACENDPklSXUMc6Rdi9KJJA5l0P5YOZjSJyxHNJFuIKXxZb1lPHVWdDYx2l5OkyXWVCXIvSHK0nr1ZjPFxGXD430aqTJYlassytQnU6HQmSGwR29UxS+l9LkrldlSTqQ/nImNVK5MVWQ6XI0WGIhdX6tKJiZ0SnYqGrMQ6FM0Br8oC3nKw/WHzgASUygrnShw6rsBGzsMdMuDlbNQ7PEoc9pZKID7VsUiGTNpLKq2RxmqBfZxJbd2m0VDV9/fV5idYKAj3eM37oz+Xq8r//zl6Q/g3vit2f7usHK86yoABaMIwCMwaQrzB0IyMsYhoxty8TLdBaM3pMwy6AwzMrIrMFsrEyqwszHGIMMIAQ0xCQNDEOBeOr8zgcI6ZcOamjEiUxs+NOHDXyUgGBwRMfJDcMG3T6VEYSw4LDfc3MQEWY1jSQYYYZb7D2xllCphtghRRO0XNEIZbRJlBYugHHCpAjIArgSuIABKkYXKgiiwyEKFkTDlsWWKnOoA5QITJj4GVgVPH1MWYvJNJIoYpgr/+9JkWI7rAXzIE9vLIlgFqSE8w24pbfcaLuWTwV48ZETEiLNor+EY44KwYmDgZRhHxTqsvBczZkrWSshXyhwTPfVnLYY+n4pZDTfOpEWmwmOOm1lpsWn5i5BEamYi1uUQBDVyB86WUSuTuiyVkVHT4SmN0cUfh17rMZdJ6axNRRlrDZXPRuHYlMvrWppVJYcf+VSRudjtG6edNSQZhYw+9LqZ3sqeQuTS18Lj/zM1Zj9+NNyq77lTZf3v//6k9jOksZ9//s52e8+7RzXKlJy5W0yDAG9V5VCwEHOIQw4Bxr60QRWquIJRMkiRknWmxnnNkMiRuTSLDlmo63nKJJFvP5pHdOk1yIgCwETqjZeutp6hBRYXLB7jzrOsNPX+R7Pu16v/3f//0mftEQTFk7DCNAzSBCTW/cD7tKjeKvzfIsTnGTDLtbTTE0DLRSzPARTJ8sDDMFywJhh+FZi4EJgOKQNAwOLIxoFESA8aEcwiCUWDQFBeY6RkPoQmeeDRCqmGNAfIVGBqJwKgU8FbCNM1glCQUuIQjEOAwaBipX+ScBxiYooHNsuEA40atcs8IAzYEHqhwQSCBhoKBUCZ0FhWVKiTfSchbd2YCwCIr7QtVRaqSisaIYcQPAhQVQ8uMtBnqEovEjixJCljSVqgsERhDxU79spYnJn7su3O3JTInGhLYagdJdGB4chMIxSNVpOBu0THzBcKD8p9qde86WFR20bsqCtYtmqJMWiQTy/Z2i4eF8PagpwwbKpTFB8h3e9WXx7FB+hlgpkxUORUjRI3FB4pUD0FymxVfpH+wotVzMu3Q3NashWe1qLFlKZBHJ0iyJL3xKLAtF8SS8BoCJCNDZ8y5rYps4gWpvVo47cwpQoKRhwFZQczdn86k9T6GAX6L0MVlQY7oGOFI9U+v//v///////n//b/+Xr/+R20c5G3RDy1Yrg3+olk9MsNBAABlqImmiGa8U5kSGG2iGZyMRhF2GdxcAUAYaMIBIZjQnDAQBxWJk0AAIChiYTChiYOiR1EQBDA6YSDihBhsCixPMUkwVK5pEiqZlqGOCFhgEaXlM0guKZhYIBQExw1IBgNAWiLAa2gsGMDpEBc5CNBEJJgY//70mQ7Auqof0UrmWT0VWXY8RkjBKgR+RjN4ZXJaxYjRDSMIJCowCR4ktA3zT0UUiy4IZwGKDhQFAARD/pFIauWGFNRQ5Icho5k0nZGhislRMHINYBo5dEKJuM0Yv6iuwdYssTNgASMRxRRd5IJQZwG2ZLAjfYO1ZbZ+mqOq/klEcwDx2IvD8GR2S1hkWV+nQYSdEU3fJ64SiGQxBLKssnJXWj08PpwSC+lSGglj0kDQrmLA+hQHLZweEwSo1N1a1DEtMfGJIBma2LqMfSvaEzIzNhLIJeaE9kvGzxUMIqBK4nCJS8bLHV95LxORokpqjOC35ghA0xw4WHjUZk7Dw/F1VUARcmSwMntRNaVVkKA4Y8okV6goRBh4tNk0JrqSlJ0Yu2KP4k7Xx2Z40q99gRg1Bvg9Onrd9e3/uY3qbT7Mhil9YyH1OQDiJnGBc4QD5UGInAobYBj4WglNLDDI1YzBnPS9DXFs3J6EBmbuAA4cMqNDMgYQJhojOZuhmOqItPmQBxjAwYOSmHBwiAjBAIyBZMXMy5BgogYsLGUjpdMKBCdDEga8ZW9azCgamQZM7PFmGMiANXLYnRe5/FBTEAzgZTCXELRy9bwsF24ZXipBkSXKciA5yy5yFaHrfKHR+OuRACfTrJhOk0+AIHYMjyEsMJ0EgYRqbd0+F2y5RtkLYnnZLEHAibXbTcnci0PQ3BsqnI9Szkvfqcg5ukFr76+sfaRIIz2AZdGHzdmJuPHJTHG424IfWM3L6keUnHxNEosTQlmD65KO7Ny6tbbOlaQyaEwxM3R5Kx0O8aowMBLKERsJJBRl8u2ZP4iqemZNXoITd61hMcvMuoBpiG2mwm1ePU8OL22D1nzHGW1i9vm2hzKa+F1a3AqRwQjQEKS6Nu3pU7CPfARI+rB14Lc9sqRqy8hpFnS6TQ/pHSVcuvA0lzMsRAYKmzbjpsawshaNyVVOXrqbt+reSjLBcfinRHJbQ2B8VEqCYosXU4wXFhGkOwabQEAAYWEGfpRqTCZY+nKL540idkFKzGTnBkZMASQxsYNheDSwwzs0EziOA6A3VKlTEQkUbZEiyzoHKRRC3wsAmTBiRKUKmKR5eFrDcwF1GCW//vSZCgLCU5+xat4e1RbLjjWBMUKaTX7EA5h74lzPeMgcI9xJBopmW4OCLktk9IgdIrqMQZAx+gLoVo+ALTUaROUeew6nzNMWI30aj1AVjGcjEe5tqtHLaFKcK0BSBpPBxF2YDJQEiEI5DTSX1s/oRYjKYlQttqnXbdhqogkCxrcr20BYfL868pdLtYjVYWV9BYFxK1J9WwkhDxFn0uNrqRdNy05IJyZZWd7lOtTWyxXxxv1I9cIzDAT6qbZYKdmVke7xeYGNYeoxmVq7bVBZWngllXBlbVZSDdt8RuyyvlYjmC7bfbAx2YGRzbk4r3a7a3cGdnmUj2diXLzupABAALTIiaWqDm8mAwOOFUhmhjaFkNDj/yvpju7xrf5PmfW/VWaAzs34i8hH937XN6tp7Mn/d+zfyP0HIvonoRMnWiI3qXyMZ70drK79NCMyIIMVznZrZf3BPniYdLhlxEGP6qbSnRpMgmgzoZvUZtpBmMCiadNA0bTAYgMQAEwiCjEYfFQ4PG8wgAjEwv0DGgEAgGDrQ+WsMYTHUEBN4VfKNShDeZlRZ4iiXOQnnO0CAZVAoqWVcFmrTmHpfPun48LbrigtJZq4QAZKDAJvtxUeSrhkR8wENIKlBIi/DmJ8toYRk7T/OsGQPhKsh9BrBuiZplJkjSYmZkGi/ChLZhpUyShXh7LJB06qlfk8TyMxWoUdhvn0rEsXgll1xHGGm0NiMjMxrsvRfC5t75ExcoawlwPg61epkPjrbKT9LqthS+S3s5/MxVGSgkakzSbIheMKKY9mhRwHJJGyakh6oxG5gItKMpfk+kGsy4a0i1IullFuCdglyPgty4TkXnEf7W3yo00nBcJZVn3aijaegJFNBL8ZEZwWG1YaHFxbX5/nYqE01CAgAAQAuoLwWVE4SqSLJUakTWLaXc7pRnp9Ohzu6FU8D9tS8PmHxJhTx9+Fcxf//XeX7nymJ9CHlmk6adS50RGfBUk1FYrNWZkCOeGz6CInUyb0uJw6wyxxal49qlVOqCTFVoqJJmAOZGKGBEAjJEApFAgUMC5Uw9E8bkBlAZwYdRwwTMiWoNnp3GZq8wpFd6vXWHSo5tKeWWyhASghX0gJWL/+9JkIgNpj39EA3h64GFOiJUkIiJlVfsRDWHpSZY9olRQjxGrxYGKKZjCMdRj1VuXBzOUIGXkOlBExhGgZJChbkWhgqyVkoIROjlQwplGQpkCimomBMzljFKFqLeSpyBnFEuz+VysL4RxtbLknEkPUW8/Uck36MHSca5Rp3olqIOe6jcEomGxdj9iD1JJiTbEgSWys6vfoYcm2xDnBGzqg+jMYUelWJCjdWEgrS5Qm9SMJ/rldLy6RiiSkFTFuQlRNG3FHHWny6rUcolOpWdUo5VJ4fSmvV0XdiXz+yeimRqWRL98dkReZoCsVrArifqk41WxFxZ29yYGZtc7uahN56spNGQGtvRFVdFhPnFPs8OOBECH0FRShxEoh6lnfmSvqMKNp1o7/dGPol1aMZYu//gv9Qoaj2HqJd0JZjt9H34RE9Du4ZqnYnRCUszat3UUr27M1CJ6I5nQLT/u75bI2DIXIFCqyklLayg+IaK4CtnRyYJrIBYKFTww3BpIxjJPMA0TRAzcMkQiLhsyqYwgJQmY7JCYa65Aiiu6ytd1ktF2qlX+wRNkdJejuJ+tlEIqIbIO9HkvIIMY3AlJln2zJwTJpLuK8Tc2AzjiIWfKYalS7LGacZfKwkTGijqMNHngZJMEMVSPLiSNWykjOc0n5zpd9EXKtSUI8lW3uaGHeuj1M49VCWHrbgmEnAQo+k4vsxblyp29BItPJVWNl1Kc6LSxPUMXbA5q9U0Og3VeX1FtyioxIkwEIWWtXtSEqJ1FP85DSnRTxcNRPX7PCiJuai01vjmhoWb6PXMRNznQ+NZEsB7q1UuDckEmRhyVKdNpjUDYkz7fNL+I3JlIyObEtt7Y+eR0k/UTxsQ83UdtGM7eoqu2KE/Q5SqpKNQsIAOLKjdiMXrRNbv/7dnQfzeiuT+R7XNR2FgMg4I8OaS8JjPHboEGPV8a/zHqQnqvDdWdjsLiiGpvwvPL/1H60/i00IIHff3SkNx27//5unRYoHRWt9uux/IngpKRdft/qUbqSnaVCASgIDNjHlTnvQa0boFGBnkIUAmILGMEFAgxRMKCQxCBTkFPokwlQjYmYy5pUcVNCXBa+67gt0L8zE4NZWCGof/70mQgAzimf0UjT2VAYqr4qAwjXmJd9xSMvZHJlTsiACGLKYkSWCekiQS5SiMF+WFRkqRKHHwSBC0Wqlc+UWVIzljjGSeCpVh/FNhTHXVdmOcj5soJA0FkfxF4nR3A0VV5aBNMZKjU5GzJ0GgFi4oL5KIoFm0NehNPEoGgwO0pScWmpNW1ko+Zl5crLi8+WCPzqhQsQdKxLXNWK0Dp8TO/XkSY4L9Hwbl1bRwRRENvOPLQ7xiZAxCsfuQbjohFJe+bp1IeHj5DTE9Yfvkw1jPVZmuOFpZEgkwJjhsxK46niEVC+eLTw5WDmLV7RXXLVAZuHBxCsINfjBCQEAKFDw8qhWq5wdvGupWDv5qILef3n2TezKcW7VRTBofzy2d+Et2I83ML/Ei0i0QiJP5sCzJj4REpKa5FlNPPqq35r2iasN/uWMbpZcAEdaOyivKvbddn60OiRLU9/oX/oJhTaAREBwY+IZU51JAK4u2Z8qNZuEAlkCCGughQJHiIkWOGiVN1HAUCl+fZ/lYfyGhoGSX1FGqNdNoaMkSMU18F+6IMJQDeY5fCenU2ySlsH2I4qyIOQxIk7WdKMdl+MVBj5ulTQRjvSFJ8yUtDVKtYLNCnJ8hRXs6hUioG9BPA/FK4QokgSh4BcCYQjgMPbXwhnUpG7xDsQDIuEZcoTLzQuE1sbl4zhtpfaLp2XiUtFm1cNGVBfarqlYvwefIRiXVnHqp4vF8nsL2DF6NYVC8pWthRZCP0KiEvNBJjYLeqRML3GhaHBxIaOLXA4QiQrWHtiedk89LiUeUbKowHuheQjo0MDThwwpKiurVtxENg6fYUUUYRucjdEq/729CXh1Azv4qHnmh/dcYszXfN3LOiBoVB08GiTuhEcipiMevksdhTHhyYypWzKK9IrfBHmDabO7aO3qjdWx5Mss4t9Td12pZEZsmlZCjkKraEIl/d5AhhQQj5mkUsgSsgGKLFIExSkSwkgAwCcxZJUhMA4OFCsoZwG/Sry+JfZSKuJWwBHKjMuh5rRYiYiSPTqJCjSShLy4l0LU4S3IwMkXAOoeKLLe0OaEk2bRazlJwtFHGNJjU66P6KHImB/IxUPMXKjssGMrFpkEhw//vSZDgBeF5/RaNPZFBnTvilDCM+YX35GW09OsmTOCIAUYuYLnBxCcKQuTYO47sIIlkllDKBDDjBIFMAbkhzAdSljIg4EoyW0H4gMGLyFawoKg6UPgb8m+B8pQDjUwOmvL8DAnLSiNROM1Z2hUs0nYN1pWGshnh4qN4FzSMhwvoS0fWimmOffWvGxaSaNaeMzTQuekaURD46VpdVJh7JiA8qLCxdpfbQUM6RuKkreLDxlcQyGbPFNbBHMCNS2rb8FAAMWQmtmqzZz6M5feGZIP4h9WfkNqj5gjkBPsRpZOedkLJmj11Ndid9v0nq/NC2c7ZOGRcpeENiTXSZ/fuVvHL+mXfPJiP5DJH47Fz/7n99WzPSs1I80VDLNIhG1WwjULFyYbRUkk4kKiAE1wwyE82QcYKGZLGRPAAmDTIWHiIYRAUWDEgAAKMYHQzRneyhgNmbCXOySgom4xSnbnUaWsuOJZqryzUAMOdhyEtCQCPB11qVvOiAgYCiaxLTKWulOpXpBnENsWEuDkJmL4NSXMbA1AU4hkZZkG+ooxzwF00qVQKk+YqdRSgiKlKuU90LYz/VbEwPGVdkObcKV+qzshsy6nMlZ0ISq42wIBw4jgSH09JAIUNmyxAMus2mmWHRFFGMitGlSwpmRjyNsUsKWgT0+ulE8LhXCdNIwyuvRQsOKYRkiJaBwJDygWCTTno97Rn2SnAuIps2eZ5AKVruI4HupzJRZO5FCJGJDMSYMdaRaKw89HOV1VOnqctK+ilLxsSECUIZ30MJEJlEDhdHQrdH/ORxZ+HrrconzYz1eQz2aFyBESFIqkGaBCM/BLSp+RlMZm08IyepBDW05Dnz5k1KQmq0qK36qz6OvlLygiEDhuBntJ40+lW5a0jAoTiZ5IWyF3AUsc7oKNNxQawGUjMTWaDqQMWFTkmEAaJTNuvIhPkbBG4O067XIdjtMytma5WsPO1gwGQh+uHYBx8iHI5LJOUCkB5/ADc5aNQbGxi6DBYZgbJw6E4OzlcaE0R0Y8FALwrOztMaJT98EDQSCwlK5PKggFlGKGEOtojDLIKCA6FygUJQHE5tRGmTIXkxOdsUMzRn0JVAieUph5PARydtsqP/+9JkVgA3gH5IWyxNwmKpGLUMI1oiRfcjjL0+SWOmI2AhinA4jtqGK/4TofTsjJhDKUByCNEeal2zsGOQwQ1RKshe2kpElXXkJS6T43mz3S7CVPMIvsE4oXQpWEqRzY85wd6pykFYjQuAAOgQiIu8tJSZ5GVNSTBhBIbGIBDGUYi5xkfro46OJbF6V0EWoR9mgbpnLEKPuh5Tuciq4tmKqqGp/59vTP38oLDzEJcTpagk9SR8o9D1m48ckBzbCa726AeaoZUWk+Awk2U602pVRUDqDhh6mjapSKZwhHcHDhacGEHOgYS4GfCyQ60RAmQJIzKcCjBsOo9IXlFaZDQX7XynezCNxFBhJ9oqZiVamrkJBxZuqGaa7S13vC2GIBUCTExC2pQjqyBfTwQh8kJaP68UqwCiw93CUJpKdr7t+6KdaVcAIeMIa6nisokqpCTHIICjDSEDBdluDbDHYRXhdnAlK5PwpEDOzPlOwvWd6rZzqG+nYhnM7mQkhERoSMkcIB8bm4UFzpYnKj48VBgUGxQcIBDg8bQknkSIBWVLwKIEhwsagSroj1W5VNqoGpimEOiwkVpeS/ONoXUXw5AMuihjHpZDfCS8p5LFW9ja+rSUZyWQpTV8l+V60mwAcBs4y0Z0VSrb6voEBGm7u6cMevgw6f5+5crpxNN4ApuWLUjbGYgiGVwQsHPQjrnXDh/DkJBja3V590EGEQUhSdKPUkRX1hxesz1W7nqPf4fUSJ/IE58vXaUGowAAAEh552JmgAbSp1HmLAWGkmgsqOrTBllJxBDqbCQoYyVBHZRZRuWpDiJT6xFUyDr/KcyCRqySuUu2+dmdb982mO+wGQMOxd5iNK0pxlnuc6mDpKrQVJGTw6XVmS7yE1oM8yCu4D6Siu4MAxWRxh2IoVSoyTSaOCkUhrcTDMfVpZ1cSiwIRKJyhOWUSBnLHyof+lMF8Bii77zR+YT0sXgXNnUBa9czYyaHF/ikPy4yx8eS82sPnViGhcttAhNHpdWnUnVIm4xGhlG648lLDmprKyjN2yQUhSDf6orthpS4R7Zpew2//KfkxEMj4gQiPIAAuoTTkOEFSYq4KshG1JO1lIn9CbPhUIXNyP/70GSHACeJekljLDewXUbJGAQjHh4d8yFsvTkBub3jlBSK4iv4z26FtnFQQ9A6DMKLAjRXdHgMoY0TBjpPtBcExzltdeQSTAFwaeAcbft0ql2DknySI4VZvr8BOPi1HEJy8pKNKW0kiBQSYZAwvGBZgKabxI/iZgjdXeJHTiJARphBIpU14uyisqZ7Znqxm6J5sDhrKQQCsVdr4w2hJi4sanKwWQ1U9HGYyX4ynkdzOVHJZWDCS44RTpladjFCYjRYSZLo9EcRBYkw3K00BuKsnaeWCCqdKn9GURckeu2ZEnga64Y3KIfLEwsjY/q4rrHdtTHHusMq7vKMI5FETMxOoQiBEESG6zHqlUCqAmQyLGqZxY8m0cji+3CcFNjJnrSsh1dFFFOCOMozkvPE5E880ueDTZo9/bL0yJhu0nJFL/W+qIo9l0kUP7KpTThN1TKbs1rkwIAHr91zkMnO0IdMIwQdmWdSbsXxpqaKHSjfjHKb9588UNyjpppCKiNS5YjcaDKpxCuQGbvdValUgIziZzlGMc7Ixiorvq4t3M9rImiVL2ffR+ef9tKZ7clVS771r0t2rrK3tgxkv0RQ3ZmcdUSaNNqsRJrHBFQPSB2JgFFyF6iJIMmIWC3SkTjOMIeGg4ZW4vEJECzOQgrCMhQniykJIW5KQTwrBcCilJSLSSIwGJgXkQuT5Vx4OCVqwC1CLE4yhJNSCnmxmqn29c6RC+qSwiGnkIuplgtp0It48cBNfJqEwZD+AOb30/Luri6YIZPEw4w4TxNMnXrCsqOa4h1Q06r3lp+TlD/ctSOMHbC258fuLlUVk6Ki27lG4343l3rHtqg32ve3zEbUqU7x/DCx0rUa66tlurS2kdYlX1VsyoYW+44uprz0TD+1f9c5BjZ6dLavHmL63+KK7DSAzJxvvONtBBKFojodepmeuTOeSzsHNMrcUKrozDKFZIflLFjaGtIIDTYqi0YJChD+piQ0XHKkTRYyFmJPlAW1oFWuQA0GM6NkArCVSlzDM1/oD9m+sLrUJrhiR9CBCSj1O5fmSKBCmQmb4RtViexsWgEQIyOgAwqCbdQMwEixEDQCxEW5Hhw4QiYocxRXksf9lDf/+9Jkv4AXmX5HIy9j8llmiPQMI14flfUhlZwACaq6YyKGMAGuqtNxqJmcUedy4mzPCENbgF+oMtOa11tvlj6SuSSuMZxZ8c7+8pBDtJGo7Ea0blsjjU3KojJ6PKpljEamEspalBam97ll252xVnZ62/8so6muRS5AD/SKctQVHrUVhigztas1d93Vm6/M6W5hN49qWt57uX79HT2JbYwuXM79qx27l21bxsbtTdapl2rat46uX+09T+Vb+92bF25n2m1O0NbCb+jhmh+zbxtXN67erU2d6ve5yvvl3m89Z6vX8sqnPvz9SWZ4b1WLAAkBAN6ETCCN58yl/PmZAkLKf9zelfYjqll2EUsXy9Sa+WxqtBkJE9125sKZlZZDOGFRiJs/POkTKct5YpxoeQ/zeZlcqVPNr+fw+Z57mSPmcyzIvhxd7vC8rG/Mmzdy5eNMGXPJ9hYU0ipgBwCABAAxBACgICAQDE9oyECTGIbMNg4yIjzJSINsrgzEKDNBAOjt078KjSqWBQ4MSnEIS5rFMgkdBA3MEEUzMNEQgcyDGrIRhA6ZgJF0AUQTJgZiaQEAAfM9GBqRDEJDQDHgKB3YM1KzCCUwZmNcKjPl0qFwEHDMUwDNY0EAIHMTAyAEM0QjG2MWfxp+MYAjEzIxIHEngwcWBIMwRCjF+OvuYiNhQHCg0NDBbkmHiELYqYgFsoAhEICtDcOB1yUTLGZsnMgHBGWGNAJlImIBEHF5hAQCBQvcgsXnViGAVHxLuHH7tR153sf/ABEQOFH4RkL2hgeCgNIx/RwDfZC5bSTRABoyyV534cZgiOENyWXx5+Ic1K0xCy5aVKJOh+lhIyzVY4wAylCN3mVvIwmHHwn+3Z+L4YRiJ8lkCV7sTpI/EE62NL0U0UrgZf7AJahQyN53HaQ3sdcmDLjzwTQ2aaTwfDMzZ///P//+f+//////////7sth+pTWZfnU5OV/tXrf///////+r27MSvhUnAEBQCAQEBQIBgMBAAAh5zq9SthKokY6yaq5R/ajV6kYb0QpWKRlrqnc1YiEOlq8VEBfaEkcChXZ9mkIGvkHXJllsO9Ns8Q3Cek/OhIPzITjgqIMbUN6mj/PBv/70mT1gAyFhE7+c2ACr0mpXce8ACHNozb9rIABkp1mR4ZgAlLAfIt2ZzrW2VuPBvc1AlXNczdSKtXqqGoK3VyoahcH6C3ftbyd62/9weUXFtvNY2nHCDHpHgTMESkzHLPTFJYuYjY8pPIOETH//71HO3+c//Ud/yJEAAAADDPSgOKASA2ZoeXCYIDNgbGMauU1AogzZ4wBJFAxYoBEhZc7SOamBEHRofA5oI6CHjXOAVos47xrLhZtrghFMQcyA3WBzToEqBZoIOLTFiYOKaAulnBgBgolBkIMbmmC9ypJIqsnWmMsRTMIKaClcX2L9Gi4GFKZIzKjbMX6R0Zc7zmQy0MvgvNuDIVorRQGxlvG6phQM3y9bvG5uYuQIFWeoE30PTka6zJgtPALWVyuhXh2HXKgaNT8remM4QdlFoImI3FOylnNBHbtiZsZcuuFTbr2bF+JU32+2bP/byytVrX4YVcY1YiVu7G5Bjaqw1Vt8lOEpt42rkup4/YtSyhhmrSXq2qStewAEQKICM3GLMFWJuPjTUjwY0cFEiKZxspIGgQgHkiw47TiFLo2SAbCcEqWgZIcgUFUceTIlqhAKdSNHGnh0vGD0EXdj6gCTaXeE1lFo23L0FQ2KlQoFyMq1IbUTos2a+Eqv770UxAACdOvG3Nh6dgdaeGLEwQFmjFoIDDeVAAAKLZhw0ygmTjMUQGRGk2boJkIBERZMGEhgJsHG+IWEBBEHqqEm4yIDQa8RHAQUGAhUACooUhqqHogTTpKCASwJRDRBrSsQQVWs3NRcArgVIkifEj+EASJxjIFdGVwiQDBmIoWReHEFXwcqecIQDCzQ+JZ5eSjKu1lTZaUmIv9WGZEthVAWOiCzx2iQaeIgSsksyXRRrAPCKZiy1kvasYHGL3Kma6kM7bDl7O04rkKZP4sZf1O6z1wG7rXXhstdfbkpcW4+tqna7BUqfV+IBoo416GonjEIvMV6a7LqSNVJVnHaaX2aaVxn7XKBxpPLodjsJpr9PQQNVvSqHqsnma8eh69M0u3dnsLFHHZXGZJVrWBQAC4YLC6SpMHIbP5RBX/a3+sSJKJkMMFHVkxIiJjUFFLbTj1WclGrQhlv4ki//vSZKwGaVRoySt5w1RexylVGSW4JHWjJu7p7cFglGUEFJgaEz4kibRReMB3JyZREWJq0sfzET9L1T/WLShHM9eHS0RYlFNCQSPYisf/7iSUsp9NmiABOGGwImBYYGciTGZA6mkJ+gVkDhBqDJQ8zV8zzGQbTKshzCcHjEYZAMSpjiPJmch9tBDDJ1pv3oJTBDQCh7AJIh04yhYAEAMhAS8wxoogmVPgUwChhjwJgAoNEpEI4I5rdAAF/0EiPyOBZ9wnyUGSqf5oZVB08tR5RtaUW5Z2hSyRHJTAeDq5QpN6eB7iel8IshRIifHcLqZRJy4ikxhunKKUgxCVMj21jTpfVyeKkc1SyEGOoTEth1NySjOLbtQMW9J5eckdAc2Ky2ZL9Ck3CaECni7EyWoKoiQGxcoXKyNSNYXFrbzlWFC9Q1aZU8+XmvCHO7O4XUlpVWxt6rmclQkal9TisY0FGRKKPV9RTvnh4vEw2TqCIoEa4HArPy7/nyA2EgcCYHlDo8whoXZIsLGBaz/GoA7SHayz/CiCgEKH4R0hk8vKp4pkUoTOJGlO1smRijTNYvJc4AiJ63CWDCCrg7NjVMZ9Om/S6AZ0uAjNB5LOqm4w22aowBAAABbBMCEYKM5xY37HDTMvPPScxS9jy8cN0jEzOPgAQTDgdKAAY3JBictmcEaZMBRlMhGDscoBiDirigwUKGqjIBEABb1xxAGGQmWks80k3Qf0ICK4pQuSXoSVAOUFSEBPYRofJKlAxFsHJHPFHFiMFDinClFgRavNQYRpAIRhsrA9YlGa5zlYcRcELMkP0sK50XstyPLqOpzRBwnW/VB0nqrh+3OlZOyONhLM56qVAq0uEWGwrZuq80IJ2qByXZXKp6u35xpl+sRFa2Qi/R1W4rSNSx3lhXa3M1OMY6zROhbP59AWX7A8N2d0hb1EKNUjQZjeWEPXSrXCfVJup5tM1Ju1BFS5iIqzEdR0j+oe5/edIKdHIsV+A8iV3I2T/tu4UNq8HK1e//ynX1GxzbN9/isQAIBCuyrMAQMTUYSRI6+y83kfc/k2qnXkij/TEkTuKQRLchHMn3h0smuQ+kqn4oud0iIkKkmJJvTQ7TR+utj/+9JkuYaJqXpHy5l7sFMl6UYYI7Ynif0UreXpwT+840RQi6v9FbnKWxQotKOaSLogy6wXytX1vWNBAYtJmDQJuB2Y6zGyjxiYKZ8LGzgpmiOZWQFnDfSNZsQKn5GHcnIKBCxAKyYyQkKiQpDBmqsgCmXtBTGWBAayEDokNJ4oAhGCj2MgpfrzL4IUDIAMpHhAQfw9IsxFh6Q4GKIGEBXzeFOH6iySltCPlMEFECFuN8uYPgT89A1LUMQ7AuU8lhDRtmSLaLiK6iQjZKR5jpOkBuOY4TOZEGYL8gJkkvUo9AryvD4c35yzObEgi7qRcl8N2qoaSDEupHY0WkFk9ed7S4pI/UCuWhXKiRfhpFuL4yvU3IdaBLynarLuR4h5fYDmj2xrZG1RmWgUvMqbvXFRSSqpoRp/s0spCmMnSnk7xHIUmEquD8lZDRfMMAvsGNQmTpIalS8R6dEGAxF1Vhvq6643HV8jVOrmd9RmSnjmXiC3XXbnuABNVmMgSAyB4WUpWMLTGEV5ZfrzONLlGaWdU0e+s412pCQYSDGnMjCHOgqb8niF5LzXyOZ5+H/5fpf+vI0v9qz/8Svz1XK7+qt/+blAX8hKIwAB4eRUcnzYHHZmoAmffnD3mlunVhnIGmWRBQODUhliJlCZFDBQoBETQ0qMNYQE4EmetGISKWoECUeUQCERFFeqgqcBvch8SiKpC3qqo0AkEn5LofdxJZM8dSg8/KJoqUHRhpxoZQ7kglViIRbFxEuFXLCl5GbCyAqhUaccpSxLSvk3WcYU04QI9xcU6GgoQZog5OlADkR5Cy4mUeSdC2FKJwTkhKDL+aJmH2CyQ9GmEsuSDVzfU8jXL2oFE4CSo48dsDjY7mkvKkLCLifzs2UuiFK2IxDlkeFSVJoonEvxxHGsJ8/DoLkaajMtWmkjlhD4a+YEhgyGqkW8529VMMdGuJrLZ0o8vqffMxqpY+47igqMRDkm1Og+n7MaizGVKhX1UhhhEXHVLSk0OVixIVxLRClafquKhaO9laTuiJqGkFEeB/qlCMG+hykQ9nm0AEiAADiXeV3HctmZNiwk2dczUECDgsLnSIyUCQWC4dBkubNBSPGlDzSA8VBUif/70mS/Azp/f8QrWHvwWOJI2AwjSiqt/w4N4fGBbYci1GCNiZFD4cetin7+c4ibQA5lK1KcEeNuG7i/ag2kMreKkGMOLrICNRqh+drS6HlIGhg5iKSZ3kFgsAOMY9TAFuABqawUGaBwOGgCHAggASYpIxwLMDMDIxUmJkJjtslLMHBBqEm0ARsWRFd4yUGggoKCURGBxVFVNi8D1MAcgWSiWhML6sDQCQzDKlrCEyk6ioB1BQSwbuDWFuFty+biMSR7R7dl+2tqCvEshZ5btPIvoqNhbNVAk3AboaJKmgRUYiJRh1lyR6OO4NcqiTKJDTGD8PMxhuF/FCXYi2hDC/NiWJ6Xs0lAiTpJiMRlPk68CPpklCfOc/laWNSkqMxBHarx/QSdCZHGZbUNRjJo3HIky7qs5GoyTQsxlzThRbQsv5nF+gDXlLkp1KcisIfAG+QQ1TOU4z0mllSQhSryjKcUpREtLuokoXWcvZomy8YSDnqPNqOeS6EkCIVKTQ8xqMhuH6f7Ck+2otREHMpGliXjqL4iWY4jXiFwyoEmrDWQ9SOEfIEH1xUCClpo61zJbbC02CblYTdAU/X//36ahd8rsZ7N72y7E3jChWPvXv+hqJKPPvenn07fa5l/7q8239vz/e+SmPb1iHPMLe3lrtsizrqlBibjXz2c/X4/9XJaAAkAADLhcz4hM+VDBmQ69kMNBDGlczyVPoGzGiYYRzEw4ObzIglMkFVA7AJcmAFRHExlIa7KXs4ACTMcLoQeDDLaUUM005FxuwiVCETUfAuUcCDSL2ZwQcRlOOkKC0mHVQFjKt0nX40k2tJ40IIwlAXonAnosaeNEONbJ+1GcspYuRRshcBckCeCeGBGT6ySk/xmHsTIhB5ixpYfMVhZCVkEVaNShfEMZzdQSkXCUHxFYTpPsZR5qVzQpUnWssyfYHaJRRK07EPg/i5p5iPyCokg5lWxLhXmMoUzCOsxD1WVEwK0l54QoxVkqU5LTfOtWNZ+K1gQpSGE9N1bLGpGUtiDPdWoSXhLpRFsrMzQCjP5NJg4VSbhvk7XaPamwvTkoVWQAwCQqFiHmkUKV7eyEpV6MYCAKlUEzhljQpQsz1nZ1anE//vSZKIDmlJ/REN4e1BbIKi6DMkCKSH9Dw1h68F/uqJEUYsSCgzQMVdRAAMAjAAAABqZAMkjXFmS0XF0kUKFzB6qWer5sTPj34ORMrDErkp4szFsQ4Qy0J6EsxYuVHMIJQNkSIxQ08UfMHIeYkND1qEw0JETxYu0sXGLih4NogyKsIljQoDAoB5CZgiIP8m1DGlRoMmZYAEyCjZFYIVxQVAngJAANEBAMMDbJhriLLsIfRHppMmWAWFX81AtIhQpkksnQkiyNERkbulQ6YifSc6pX0UvZ/Dy0E5YcGiM1TAH6ALAzSPEUE1C3chQAMxKA2zmCRA/waIhImQpywN4uIZgbB+p43Qv6iZRi6E5GWk06QAlRXD7SonxUj8S68nzBJCwlCXM32QeSsYjkLmYJ5nYMhjOJUmOSRC1aXBqNUYpZqg5GcuiTQQ4zIP50cCCJ8jzpLmUKFLlPngS2U5DxJabyiUy8YBoMSRXydkOQgok4aU5ekTpUpOkEyUEd5RK1mOBXoWuZD6RZnn8PFIuaXIEeZADmRw/B8Kldtg31adSbMVwPkuyJgQnp4BzoE7Vwpj1XKdaTD5b1QjygassabS/MVZiM5+s0ZLmO2xoaBaKqe6nIZmal7NQzZhI/QjfwWRqwUwRV/r/Ts9tWM4/WWkzrU1fnUCbv65rvP3QrqRTaudplIU0pCvVdCEVqI70uk+f0Yh37NfoXncjKKed5ET1f3U//OzNGAzM44Tj6gWMQAAWeMpc1FiNs2A3sQkmZuDdhIkLNICRYIhAEmi/gKOKpaGiCxeBLBAplsHuuim3zkqrKxNdVe7CHRVdOKGUqF6jIi710yds0F4Oo/Bil7LqD8FtnO8covwqBPzrIaOFfHCF+EpH0nA0SUGnlUCCIUrxdTWIS9N48TebDgOclEZWkmrGSjmi0+P9EnwOOG3iTHKhzowTnQ8tWB6iEMP90T8wi4MyEnycKYN0oDHb4R9olaJehKrVLagS+VYUMUpWJ1aOUlByJQ/4CFlUi0ouDza06eCoVhhNkh0s5fFWephmKQtpNVAGCnFphclYcRtmQhT00HNGvBhNUJrOlfL23FsV7W9JeoueRgNC8GoQoagqDcT/+9JkioeZ1X9EQy9mcGKtmKkEQ9hmvf8RDOHnwWG+4pQQizgS2DA/LCQFycCR4cnxcRE4yGwPjUEQrSwxksrB4el8rG7wdGS1SEBghAAA0hXMAYq26x/zyY43fiMZACMl1BMuq+F9zVa8rmacjvs+n/r1Kr+SD/U14Nre0rpkqM9Is6FMys9upg1WEZU0imTaIuzSCEZVpl11co6bjqRNow3Aut4yqwkLPljlwGkBRyLiSoTUEthjRkvGYcZTmVoDYfVA54AanWHIMRVGl1IhprSpINQGiVE+zsNPaC+Q6AvKFBOew91i3iXOc8zNfkhbIBChOSHEoJ8J8A5i3J4UoGBUSUcxf1exE2OVRxGVdl/Vo4xBwwHMfBLSGEbdmUZpQIhlshLYfSPPktrC/Pc8S+txOkLWkw/ZzeXjhO9OvD3YVQ0nYX1DieEmiKQuR4IZFLswk7LlMkFbJdJo8ciHlM2Q2pVMyMLoehlrtXN8d2cJznkfavWl2W9IIhDjsSo/kJN0/klglB6J56dCBN+qORRunQ7PVEHipWJD4WlUb52NZl8sSTXCQPEu7UhsElx8GEnkYqZjiXaHr6RMkXKikRzGY9FchabiG0wKZlL8XCVNHAvpxDVlxhKs604Vp4qaTUAMJiyJ03OffuqQZEJCZ2YJxtlMjKlQynUBHpUZiZkewJmTmENBaMg16Kz5o35sdd6c+RrM6KLSxaSlAMOWEznI0mZj4ERsLEyr5ZTGYma7rtR17p3SyxZqAPZAAD2aDogOEeIw1GKLj0UjELQl2XJItUaDKOUQJkVgpYbrCOoMglxPy4jlENG6St6N8p4wCSZZKwkqVFwfGW/ONWnmLAdypDpQtIFOGqRJxFCon6WO9LkvQKvhRj8GD6GJYrJ4FwTBikQg2OnB4KZd8mDkX3ogmJjJWTEgSA2NE5OUJAJA3OTYrtjoFJPOTEcynIHyGR1CAXuTjqsHYuLkFgoAdOXi/p4IC5olIg9uWDQaC+R1C4nCCSC5wfLkM4ORDSlYuMEwQiLceBCIpkoQVI/E8zGk+Rg8nHleaiMHxKAUurVEC5kPY5QDU0RTYeU64aDgkFpgSCySCcBcsh+T0wUn52qPD//70mSEgVkEf0TDL2NwZs/IcAhlyiPd+xVsvY/JirtiIGCJOI5LbaoSQ6qRSGJChOUyAyZVXHyAJatt8EcUcy+1rSsRXa+XKy3ZC9K9hnCY7jUo85D+IH7At2YGrOSF5pzzFmc2v/0/oynp6OnxVadYhCfxE+msfnOOfO/uRo2i26JxBhABXGPdxuQWI0WolR+3kb6+pfjBcaIDVbBp1+xwyoNFOEEQPbEK4mk8cEEpJXDYAIbjcGT1GVSJlqIOTL0FqVFEdB0kSXArVEbx0l+MkwzSVxIxdjbEITxZFjRYsaWP80SXqhVEsFmL4VagVB3Iw6lkzRMhyhzrphYUaLMys6lKRREIVpPSUH8ZqfOEuJdGRyJ4gg3W6E49ko7EM+YUIak+VjsO7askDnAVSkVVo+sPnhCGs+H4oEiFcJRdO0MfiuWjUmHFTkcxzNhBMC/huvPdMBJXkklnR1bCSKA8NUMlrhFLSnBzBoJUZCigYB3YWDwouWVobwhaO41lFupGYEQ+CIeTgOzExoUhAIZCN0S0stkgqFMolJGrcKgmkNMbrkE7KlkhmVl47JEISxpEpwoH9S0zGuQjMnF1BRQTgBYCzHxtlo5cKEl5wxvRmfpfKICqTpVjI1XO/ZyBAUwyIsEqsjyHR6iWr/UMm7olPX8N0cg8joZJD/Ij5TVfa3QIQXyKqDGEor0IV+7hmtUzVO8HPdtp3P+CyX2DBXiczh+2BSjoKAOQkgGbEqjTgDOFgAowab4IobqZqJNqDAhSJoilqZiwo4E7K+V2piNG6T02GM7y/DDJsLemTYbSeJggxKUNAUjfb1AMEVJyKmyEIAYSoYihSh7oaozJTi0aL14zKBQlSmoZpvbNR+OcKAYDk2S0RIE4wUCYOZ0fISgzMiwhkVWUhKEJMiQ0igQkOFDE4gJDeAs0NEi9kiHJinajQj8nG6MUIlZUfZKawsoRfN0x24VoCkrMzZLjdjpKk8tGHm48lh5QOJ4Sk75KVKzgUGEJZMli8ksmJkXi3ZpJcYlQ+UGDJWP+HQ5PjzY2CQanK0OSurKUhDkR6XuO2jRwunJLWcgFupycG+mD6N4Yr7wAAJwAAdTNi5fs+c/uXyJ9//vSZJADuIN/RaMvZGBkb9iYDEX4IjH9Foy9kQGPuGJAIYrxSE15o4RFwZ9WIR9fQV0iPPYF0d1Ljy7moMSR6IvfQeELfMCZvIVs5/uj5yrzm+CPHZVnG0X5iiO8GyEamil9rJLVsIR6xazc9Ai/45F/NqLJNyPjGCrEJZCgJuBP2SAAJEw5UaUrgKQzADKBF4cG2BsKJqAlOZib/JAhREOoUDadeh+MhRpw+FAaJKVIW0b5vIE9xJW0XVMua7UapL8NxrOorEQB1EYLDA0JBBWA3bolMDWyIhk8OE46DmC5koH8IwOPqh+Hhkkj+khOKtsmi8rEyqEVU5k+cwIykzApHIvWJJykuTi2kwXvh4jOlistCIlXGxPH3Vxw/CIhkidJbh6scL48h+eFN5aOR8el8kCEZH5XIa5YIRydrC6oICh/DhMlCYUKFsRolB5KIxWOg5LA+LqEgfg5LJ4eFl0yMCePmHpWNE5fHMqxMktCDF0vVNDgurlg9NDuwlQoHk5+20vSHRDtWMDIcmyJ1tXf37PGuRvDbN6yd8yfyRnmZZmjIoGiRyodjTLmgitYfz7P+fb5n+KzqlChZqTV6imMaJEY96JLI6sw35a10ZXohGDNRiiG0Q+/jGL7Mf3BHBg8OLMsnfh5+Bv8l0xVMjSLQIRoEXg6w7sj08OpIrVAzZjHN3AV5cgwilAGgCQzJVJzyEplCtjTHhYey9Ld7GBqYLHH2R5c0qUBrE8QGIzcVbkaRYyYIQhDEeZpognRxkHXxlIQWFvcmhqYRNzrIQMRSnWnCyAuHATMI2StJCGD8zMpFamRvoeciGJtIFwiqsyIBvv2RrY1GijQZHjaTyImdItC7px4rpgsJA+A4bLKGVdpaIgIyd4yuToCxhyiBgwskaZZgk3KA5/JIkVJzMOQKHYLioVIqtRofiXjG2ammwbmo2gdNQrOJ0qUkqkmsuZmgXOdonx5ImrNbG+gIk1qVMkhM/llGRSo9pSadDwFAAQ0ACG0NkWWjH4ywHWQvXMCbOhR66e64pFhSKAHFsEClGL1QK7gclT/9KJqtMna9EtRNrfRSZ0/2yPpq/9eS06R8G7SPmqfTmZy21yOyDZMQIr/+9JkqoC4Bn3HIy9NYmBvWMUEQ8zlJfchjWWTwVaXI+AzD4DslLX6D3LyzYZT0wM6kTGmAOkACNS/pwVZcIWVB5UweEdaGfDoCREgMEIHDBf8VNmDCl73RMIMGhBdYCBgoTMYAMUHFizfrsGABJBLlyFKneZMsA/ToJQw0ppGZY3yqxfpvJpjkYSgU+09zl8jLgGdCbgViCRzqSGmgF4iIcP5kEAJYwyCIQS1ISDJPOFAgVMolMk0gAdECLAE2HIAUiDX/EAKWwOFAxRQNBYNObgqcEEhgywLZkQXSjCuYHkaUaw8qclgLxKw1miuOrYyqXzjPpdAHMIdgtHATiyUTAnp3zRhDdRwRhxJZcQrmZzFiSxUgxdraVVJSddeYfWts7rC44dWbK6nR9MZivWM1Yu3zPa77G9G9iKv2Yaqv60TnY/0MpX3Gqp5Ob4y/DrEtxIcVcbQ+OfYA86YkOCeyeZ5Fz/iIGEx8szy/OwESnx7JqK3zRH/nTs4D2TitLnpoiHZggiUMGwAC5cgA3KEDirDiXjoqNvHsjnvYtjH8WfKGn5W5X6HdQ9W1/KI0EGk4iAAJhFiKYQSm9eHihacsmCoSYsRAA682zAIKJIm6YAiUJwJFL+r6RXLspsMQd5ImCE4U0mVlrWUoKLsZIoAPeSFS8Y6sK38OwImkqujrF2vL2fdoDEGJMQYDEAUd2lhXIBiWSpxvW3GAV/ITHZVTd9XCmzY2DULapFKbrdfaBWGtPtQ9Gnne12aHB30iZ6Ks6PSkwIgihyXhCPiqvHRQOtSqSCSeKUIva0ExZ51Q0b+vPF9oF0aJ5yKzcnGKkUC+/HK7KnS3rS0+uozA+rvY+RKbRXSFqM72B2F2M8sluiYpd5/+UHD7OvoSPjx21at+x1+OZtS8TfcxSGk4zVut3dmFp+Zp+bHoQgAACyCFHRBkrPuNOTq3GlWll1/8O6d3E6vVvRJhiqZZa2KFKDo6St6MjdivSpuaWhlNSj7mujZapibqKu3fXZX871/anfo/9t+rN0/+V//qY/r1R2FO57R1wiAQIO5xUSabAAI7TfJMY0BbAZEgQNKccdL8iI1IwhJZWCDQhl1H4SJRSsKXEwC7f/70mTKgihTfsjbOGRwYM3Y+AUCnh/J7SKMvNXJkZoj4BGNcC8SsDOW2noSqxiyJCOlCOgTohKlFyLoOUwBKgg0aGUWgnY3ifm8BcE3bTsFfC+Ggc47RaSVmY2E+EmJSDkBlAvjHnGoK6AxDhJeF4QczheD8MdkOEOpAilkMJiC7LcQYzTSL6m1A2q80C5oQoxtEpQsuB0IlCGdHKjmPdxX3iPtAVaw3N6ztVQU8/YKs024TK7ia2JCIk2xpMzwRSc4jB0zKVpDsxIhckSa1JIls5lOm3KPnxQiNKbumcbSveYPe4yNU7/JojrOjbLep5jrWeyMg+4MgJDAAdRiPUMUkucMKShC2iRgeIDCFcgQMjHZluXJsOuceCThyViEhVcQZoJNYpD+tuv0zMFYLEIcDoHBp+L3qIxgHMFiqXjFoajWT36lbW96D9/FBcGD7yAguBgRSbIhLlyDUEIUNQAADwBjRpriylprBhKVHlLpmQHxkSeiM0XXQNKhMugCQ6nCEpi6yUrV3IDUpF1JgswSjRSWxFmQpCvC0VEJkbauujmwxHpAcXZkiXzOkwYdYCtJmTxKmdZ4xoSsMuWRswdd1okjjxS2gizwsqVSQHK1M2d1ZiqyuUtkiK7QcgkQaT0JCOFQjdOKdFR4TQkXPRFHCxqAE9KZRnpw6U5qAqDtOm6qgbUFodieeGB0RjUdTmp2vHZIVR1D8gk2AxElSRqrSuThKLZTGxY9GZn5EMy9YnQRn3qT9IpROjqi08P3h/cRqEE1E02Reej7QpGlojaNkrVSnRILZmhxpOiWjQJQcHjhyrVoYjQatLYMCqsdHM6StHqyIrVZXHjFh1XHUAnn6+MAIAAADbvVka3dKEIExQsYaCLGvyyON6LllpBRv6WlFo4XruzwV31310gJaVoyaBDjpiXk7HPRduG8/fc0c7wKSbIicxLJKLCk0Pt1XzGxpbcxS6F+0v9etKInLu+R9THd9kTpvEMKCyNHCtARbDMgUKVZoRDFOo4oFybLJTyBB5Fh4JpMpjokm0SPAAqQonQtV0UCg8UBLoSwMKylA8mAEEECEsG6OMsYVZjqNgTw+yeDsHULmMF48Q4yRoNZGlcX//vQZPODOTB/RcNPZ5B7T3ioFMKe4vH9GJWXgAHnveJWjlABEuilCAEpE6azFLcN9QHaIyfw7S/D5VB3DcPxvySESSZXFuOZEI2BDeJovxZnMukPOtwQSsYStbbRDhw3PFEhUilV6pPSMsqdVOJvnA5KNRv4CfU08qoaHTMpU7CkRFWzKkqmVLpWMqu1GmYnNExX1HjxnnYk45JxWMKsccIp8/qtQ2RZUzCvs6kf2Y0TGxNHdrhse5StFc1NkZmbXivqr4a5gHexJaLMyx1JAibXF1dmAvrtTObmo6vtsmdv1dIpG9ct2miG8hNdlIun6iivnCBUCITp9HzFZVmOPETsqXSlCOVWILuHEEyAUYZ6Cqu8gsRSmV3UqZhZXGOgnXVJUlYrE6kzirJoWudhlqIcuhs/VPzUL+RV6GL3ZP5EIHyTHNZ2QSOhbzHREWinOVNzi7ILw6dRYpBgkQhyEcSdDiBTizisWOUqRNQELH1EIDEVjNVjA5CIViQRlxTAlARSuFgQDBzDOMqZKBBIgRHgOxYGo1hjKjThOnAIBgkBIYCQCRgEgHmbWYuDjBhIQBAlMVkEwaCjm4gOkW5H9GkLgUxECDIwYEgAcIPJ+IcGw1+VAKrqYiAKCCDiS4GC5lcamzgMZ7IplwzK0KNrpnngCAO+k38YM9nYzYAzKYlEICMEAnFZTkS5gcJiKJFPBEDvIYhCpl0wmBSAZCBBMETC4NonyiLiRV/JmiafSU7hz1IYAARkMcmQyGTDMxCBS+jM3ShT4TkGyiVwS7sIedxIdmp9/5XLzCQSMKARG8xYAk54AVjZ4WgeO9RxaJWpXH4YuTjlxLkmnpC2k3L5XEREDDCwEekaAJgMFhAPTtMDgdmzH25zdNDV+jkHaamp52knreFefsZWcLsxWvVsrNigeYKARLkMAZg4BLhn56id8HABrKP4QDE9+fzWOf5/nr/5//////////vX6/LXdd5hruP///////7N1iUvwEoJSto5Fd92vz/H0cQAAB0JCoRhISBsNhwBD85XnCkqPzmJOHQev837jDX3uZSDB1gPGvlhMQJI+jvimQcRHe83BNALIKvjBHNx3ol5KOk8vKGsbf/70mTpgAxgikxue4AAuvFJTcwsACTBpULdvAAJhDOmx5ggAcUic9U+kCePxoSx3xWydkvNjjB4LGE8pVNyHXu+ueNrPVPzbXKk8yVpN3z83dzFU/k+gu9dpusSDRQsWL9kt/////uJuTfvh79/BsfecbdvteT5oaf7/vn/j////3vs/yyP/f////giG4eycQ6FHGSu6YYtAAAAGHBE0AsNXWjm+I28wMxAkAxhqCcNNmruBopYZiMCwmYASmbF5lQmZAIgQTC4h74WScmhwgIVElmy1iUA8NPY5oEZwUlphgSZDgUS935jSkUAypVlG9D/XWywJSuAXOQTK6dx+KIuUChM6UCZ6zFI5B5NYFGa+lS6qnClzetdcBWKNUbEnneWUO9FbNOqqrmoqqupeLesqa9RwEzpyoFlkNU0NSd0XFkOUap6sVqxmKvrD0qpo1LqWUwy+sunquMZlNXHVLGYrKakapqampZTDMZhmMy2o+z+v67rkw7jUjUalMZh2W0tLZxuOizlyX9h2M4U0Sdlrrky3mVNTSqMy2U0tLZwyppTSymlpbON6VRmM4ogoKRHfFjYgvwjcgp8Z8WEA1+wJj4+aLq2BKbQqa4e1FXZblBEWGOJDHCx2VFQg5p2VDIKXMYMYTHcgEgcSMcCPY4MjleeZzOcxyGDNZTKyXe2nryU1bLYrXtdJvQ1ZjMrPm9f8v5W///5lCswjooKFIQAAAFSkkeYAUhC2a6mGiqBnBkLMBpCKROJiwOYSKmOFpZ1XZnxmGD5ogSNG5bc4uT1LeHQaVSJZ2OXpYmoi8aTAVKY5gRlOE1EaRUZWAmexpPlbSsIwDqAQFXDUq3PSXqa4meCvM4DpoYJbnMz/l1V0JHLuGAF+lGFNSASKzQkxlYlqNER7LnzklWK8ISOoZRjktJ4ZQhppJZBBUlK5i6nsP9JBISHHO2oVCRy+vp1Zfth/IpraGwwXJcnVtuTzxlPGBFOZcQVVHjIZO9XRrplTxV0tCfPzoG8zM6FuaOcGV22nwXFbUsFRM7Kq2UnzamG5TM7OSkyYKhcySrN3rpWq6z1WKY22JOqg7YbMuNybYoSncWFTACAAAAMnISxxg1RxI4i//vSZJKGiLdozDt4e/BWZilnGOZuJTWlIC7lk9Ekj2YokYj4FUGhj0O9H6u91bZkztBJ8M9XcRy5rWFzqOsB0Rws8vh84cjsoIrWTxnMeHDwMiKcLCQYPQoapD3SZ1BqlT/7lPYtyr7dR+tywmBQ2GURsGVjpGzU1HF0/HJWAHlGTHcERG4jEGzaqmi5emFYUmKQKGIxSEo4GLQZGIhLCANwENwjAkwDFRJkwaEADAOYiCCVgguAeNA5JkGmRQITgaKEoo+mQmXAEJQAVAMgaWW2GskQzInJqjDSJtleoTQAWjsNOkyhmilrjDHBsRxqMXREVjJvQummq65lnGfYcpBgpK6SxbuBGx6QEkJTKGp6L4BJCzEATqJhqgRNXKPAqwl/lnMyfBRotkhKb9jS/XgUrWFv13ij0rdVUUedJ+5C/M/AztSQ4gJhlRswhNhpNHyhG6yexnJs+0hRrUdiu8+PRKqPK/M5ecGIla1E3Rp3tVECxNSF8FSg/Y3Jl1oP6VIHHXVXxnp2bL43T4lHj52DY5jFfASAQBHbUBABgICASMgns9QohFcNlfyia7hHT0H/Q27fEle46jcPBZZKVCZmFycVSo84YwXcWfY1S05C8XPIMlhWEDRy/qMTSxUAAGMZw1MXk8OEXmOJY0Mv16N4W0NyRRMFDfM3AfCwpmDAPChRmaAxmJxGhiEmJI9GMIYGBovAojQQEYGE0AgOFgcEYNGIIhM7ERRqDmLsc5Q6kaaABKOcoxRBGCsVnIBEdsqjIJy1IANHGTHSQTFonTMIcACrNW4W9CgIKNO5s0IUNUKTINbUCArjERaBawoKRm1UEVWBFUdsICRU7eJGpSD9trD9DK12yFHm27SmzSolF3akcaZLDEHrpcd+pDLmtMJnm4u3EovD0PsBwemfhmUig6J6Yfh31eSiQCJWBkfHQgFkeRKO152eEI3ZgJxcA9ctOHg2Wl4nHEK5WRIxSenxNMk68cA5FjZNMDwYrCIPxLKxfHdcQh+rywkDyOqEYtm5SFAkpRWTTMAulRO500mZ6+dMzk9MsLKU6Z1u87fOp04soIAANzgqJwWH4Qy1Y3RtloeZqJLyfh1o9WUHZ/IyYrP/+9JksoIKNHzGk7lk8mHo2VIww1Zk6fkbLb2ViZ80ZigUj8iO5d0zVWY77wjQyeQwYk5wvzR/Jc+X4RmfflM+Wvp/zNZaMlIEAioJR1Qw4yqu34Lma+nDX4DDx4g/Efkaef8/9kvfQKiJCsHopv8ke+1GpGBvgWZatG8gBi46Y0JGxEBjJWLExpgkZ+Bjh8AhgycJdwwQFVGCA0AD63VF2bJHIWEIKkCksBg0KxSjiFKLAFUGSXIWxoJSMYCoCGCZJGSWgkSoK5vN0P14G8wvR+k2MNRHSsnMPgnIPKQ/WgWMsBOAj6IOplHykTlnVqKH0fjsyWA6zMJ4rDSOctprcmhc1AQsbB+FtHKXw0Eiuz9NyuYS3ENI9N1sCwVPkMdjpE9i8tm45YTI5SecnKISnYyuYorny8ejlDWlipENCSpRHT0oJ3E0VCSXzpOZqR/BqKzqNEseLQfHYjH8BuvH40LJTFR0SEpVHItF4mE1Dc1X6/kuKnW+s5d6I/pVw6xHvs4k1BaZLyjLtuXXUEAIJiCAY3IhMMQzCIQrJ5q/xfL/r///7uMYUEaG0ywEDypGSxJkdIht5GEmGlqnTZqRqSCbFxjSqNZpxD8ijPUS2oQdPrKbgWB4QxVZFMI5UgxPBXiiZmfZ6jWEXDRN38y6dqdpAJ/9NTRouMOG4zU5DumCPmNo0swDzzqNWLYyEhjOYyMzDQwQMjUyeNACQxUKQSGzF43EYdBIqMGhkDCMxOEjB4LMAhowAHDGgiMWAgwmHRCMDJBQMdDQFmFSNWs3wXHBYAEFAxpWIOJmOS0JIYyGn/WlIwIMHCBxYcuvNsbOzPnApbCXmLYMtaKzBnhNSyFHQYAHTTBFQ1ZOv9DwMIhlnyYCZD/P41tTcuopEv+AixYUv+YYKPqMq73DU2KCWlMUXHKJGyqMRqJrfXu7S3Xchtn7dZKxGXUa5KVwWbdl0460tzf6mlFI4EAb05NPDcim4RDD32teGsTz2p2kLS/CQ0dn52VztGubTH5UYHQkoRVGBWRWaW4bl1CdPVSkzd6xfQjoTDiMzI5G4gFdOZFw/K61Bz1igTByLi6jAMicrLTmqS2HkNWBebN0OSxFp66uYf/70mSmjgqkf0UDmWVwbKx53QUj52vR+RIuZw3JlDPl6DCN+Bawv86Rma/UCrWJEmg2pKyKqbwC+Z9qv+j//L//5f+pJCdEYIYoG8aB4hFZGwsZdBDWpo0k5zaRxkujJru6UjKeR8RtE0lkIM35mv1zqbe8oXghAFQVVWI6bBCUYdMyMZaOgN6huvBxO3XyH0E10IMjpxUSCNHjUx0WDfMCOKms7IUDCaXM3NkdG5idqhZGGKTkJJ8yiZRIrmVQQDZjGXDAFBDBeM5AHUAcQ1QDPaQhBwbTAaKZJZsPmMgIyR4EDVJ7qAmISWbbCVGzCfBB5nkhFo6A3y4ZKgPeJbJbxJpOSbJYCtFTNVZWhqojFIqEzwsQ24BWJhUMJhpTBSZrE6o/0VMWhuSZP8uqgYX/O2U+VNDuJpYolTZfSE2IG1TK5Y3ZeKRBgCocu9O4QFGGS5HNQMWJZiChraNnZVATclo342+0w0qSsVdambFL1yNdnoDeVy4Mg+N1IIi75MGfyRRZ2WywLHnfjqcL0Q9OMZtUynrjFKVudaei8pe2G4zMy6Ao3NS2KxR/HshqLzENZwI6k5D0MX5fvGRZxh93ym5Q5cWZdLGy27lWfkFeMU8xDD+XuyrdqboZZUpIfl9zUooIHeFwpyd7GYvFMqkuhuevRbeMCLoEoAFSmEZS7Hy7bn1lzoq8w9kJb/fv/+RhUm2UEKAVJ1Aj6SlwKsED0NSWl5ciowoKhjNky/Gi6vhjuvuThnABJqGwe8BMLjEdaoFUxyUNhmUgZS9CGGAnGVxEPH3GF/9n/0IACAACMBjs0TRjiTxNhhc1hJTW0tNFlQ2owzH4XMckU2AlzHwDBJMHA4AhOOAYwyCgcPTnQMKwUcMMsLEhxgl6mOAgwdMSmrVaigushRNPRiZcIwRC8sPAokDWhxSlJhAu8iqpai7JmXpCsNXFE4cMAYEngoBOKCmwJAMESJLjKcp9KBI9O4xCUqqpLLXBAKcjBygtrqRGADDJqcohgykOHckCAiQFhLmf4fpWmcIaniVF7P0ug7xNiPThuGCwCOnaSxAt0M93EZ6jNI/YmUGoS8OohxF/6dL8TuRvRJTJ9bVhJY/Lwfih//vSZHQKiql/RMOZe/BPxVkpDCNuKsn/Dg5nBoF0OSKYkYhYOs3iRRzlZj7gFuVQ81U2vUKV5xRE3ALnFN8/y/sayzKo5UNOCEppW6OwIWmzJquVcgY6XqxJmKfr5vN86lIdCbPlWsyriIgkiLtMpVAcF3+m43HBoT61hpVuSct6gUbKojJWKIPDGoI6PgtkTYABo1IFVlNQHWKqzOlia+HH8u5IifhOdk8u595DLzayqJDYMjWlnnDQSDyR2BsyEztTwVAJJJYNphkFY9yUXFWZNYbOr5rQDJxTA1+tn3fSdQTZhclG5WUZPEYMHBpkNmpkKYxC52rgLE0jxEadhw6os4IOW6CxjM86LXUWuR3QlqhUzWuDAFoY6LUcILCVwFhoDmUI5xBYEvIWqAol+JhAIRbIuTPPoxW0rCuZST+MwBRnliggMi4ulBoaKGFAgE4ys6EpjbtJ9QUnIwdeLjOJNP8ypYB+0HKrFFZSwJIeEI6LHet1y3kcLxSOH4ZgpgqGqmrSnSZo3jp5uO0h51ouq9jCVY3LdBtow3d3Y/Abs0Uhfd9pDPLiiL8MlwvNLVzAi1GTx1ctJKYaZ0+kX1SuBIWUO25Tayl6nBicvpnqbgzuEPpxu0bb9xocvxZymZOVdX1SSGq60VydWOtxYcyl0n9ZOxGXQw9EyyeD3JZ9AEOSuVzD2vzHoq28xOwh2GXubFG6OlDrNWvSSZhys4bdXTutTjcoeCkfiX6bvJKjov40WFWOhIAAAreoRmxTJD0aQbGLtL5Ccw5gTw4Ix/31DN6nd9z0SyGOTUrYVlSCczs27asjWmT0QGiMzX1+DZnWO94PMnvTbpSvsb7i/lf+87fVU1S27IatDBlCC+0Rw8dM1RUAAeelHTQhuo0b8cmisRsQqZqGFUrMUFDECEygVS2BhBB0HpQ4jzgjwrhaqfc6lULKTVRpwcRlKgbgOomO7TDlpKapZvoBRBj4egZkawpNyrYyAhChbRfDAN8DRIKXZTLIMUZApQP4YAby1MaStJiYxaMxwGmjDlN8PBdyaGIfpKTZVLQVSrJhFcScDhHiZYyD9XJJhckUGMunAmJeBBTDFKTyCL8KpmZBJWYW45X/+9JkV4O6On/Dq3h64GRPaJAcYrgoEf0OrWHrgWiBoqARjAEPIGyHWPhDT3PduTg5xSFIl1lRvjKZUqfisOZ4dLFQyHpfjvPFwYjfsShOFyhjyO4/0+4H6ezISxVDwYoSWTTAm0KobZzkVQhx+j2R79NktPeygOCK1nixmyrC3mkk3EiDNemagzrJwcpuHsdJoqad2TtWFchZ0FhL/mPVOOBYyYqInKWMVQnWuFxZyUipLtGTEZSoainGNsEgWC4WjYWOaaxtTWrU63+Xub3SOp12nZwio2jl2rmqmdyJwBGIjBl5qLNYdIatNWaoMgM/b/u5SFNYWRnZrhJ2Q3sio3o3SgNCle/+U2N9/5fqdGXbiClXVWZqsjR+77HZB8HQmHIXxk4pk00UzNM3wo3wEsEgUJGnBrzo0zL3IEyXCMhkQLHZm7xiKCivxGgcNmqEaOpdhZckS9QkppPLBKTTfvInwAjPLI6ZgozTlNdfL6W9EjKFxAUwtAwjcO0BCyRY9CuJ6TOU7z5EoB7F8V4pYP0HGMUiwlIMJtFhTJ3A5Q1SYBWKJ48HuN1NFAUxCB6m0wWMPhdDREIjps8GFUvUcTctiaLY4F9HixiuHUuTgX089MpEjEeoMhKEKOMsmcyNaXSJG0YIa53UJiK9LrhUJ1D1tEJd0ik6TxOMinZqDeis7iaZgoYbChMu6RYD4SC4UZyPohuMRMDzMA7k0QZWoa4osmJ7peKcxd1G0DVIS8OUviXlWF0mleThdl/VKHpct6jYFQeyLU0+TiSjWcSQLonFkyDT5pHczLuEsqlDVdYEkAdQ848Mfa4r+vtvrrX7rpr9OX/CBYQL5/1r7ZTRr5ovcsQO5+vO8//2vJUz8zV7NtKWwhbxcwS+n7Na0oVkeGq/Zx9NXn7UZzDJ4Te9tXmupswxnHeKwFQqVPmAADLIQBCLAUwRQyR8BGBgGCvRjyhiCycRd0ygMvCAgQcURgS6VyqA4icWeUvkTXE12WvGyV5oEfZHVtOufGV8NUYA/rrxOs37uR1+29lEWYe+jvT8JpHRZbDTzw/FpPbU+NJaOjoD56SQoHpaUBPG45Jx4GJTE5auKw6Eg/eJJ0WhCVHZDP/70mREAxjKf0VDWGNwXiBIpQRjAGSJ+xMNPZfJgJDi6DGZeOTMvRQiXEhF1YsJbAUKIiamOqwCg+Jp0uHpaWXyhZgLmSKbg0LtEE2WNLynCrJZoalVWfrMKCqFSbKGYx1EgkGxbRuK1BWOaEo2VIa4+XNRKxwKbZYOS8emqxCEIt2J8ahKOyd18pveaHh8+VQbIcJcPnj0lD48pH8dIDkQIKxFx0Sx3c987NB8GKxfxUYQn9iDEADJRApVTWPb66emvUiJ++iorzFXHsYnlK/ykfZdgzdLsf9X9DS1n1cohsv7gR0Zd1jNXk369+23qX14k7tdmFBaBPxW60dwGNI/TbYyNdaQARnaYxqBBvx9frnYIA+gGHJGBWG6Rh3UZHmcUrmDRZyAgBIAgGEKTCDgwWDhiggQYU1vsVCwNEJG14lVKVaSxGfKLPimXNIupqtZZom08Pwn5KlAcx7CEC4kmwa2T/URzGYYx8klMSMX8mitThok8J2o2xwUJ2PkzHG4cKEStxe5UoSxqIAqUonmxEqs82xAHehTg0mKuFMX9yXRlr5hmG1L57s6sRSoZ10ui7MaNWVGzJh8kVK3n4jXyoKObFn6hRzQ4GNEeYhPlUyMhQtnUjs63iZUSy3RnrgukOdM8Ys+L8jXiU2aBEuCkCgNCykYLJOXCtM/EYG5ViHod1hAsGIxHFgAay4NDsSDZWiZFbpVJyY8L43PxPVgTMzgxGhITisoWaVEN/iacvFcvj1juKABQgAIIwCJe5EfYd+XssPRJJCSreKsI8hpl8lREylZg8jSZQTUvA0/Aag4A0MtRe16CWpbDdbAC5YYQwwPGqe1BZ54A70ThBrBNODpJJ1byxQCmQ3FAhKxdgGJitbjeG4IpWoggK025z2GNMYQqi15ogg7gym3ZDpVmEiZEa9qS7bCEEuwXpD4SWS5CxbTeSp2qM0RytqyziaGHMT4hbEoTqKuMXLLpPvkKSjKfBAVEY5GzkIGTxnJQxksN2sJMjBnV6DJyhRlsBrrMM4B9EhVEEInD6uEoe4zNihFF67UIdVVYxGNGC8UGeOB9VHA9iHxmnGJYKhFJhaH7DtAgQUrRIOniAcFqTOA2PUD//vSZFYDiDZ+xiMvY/BoTqiGBSXCIo39Fw09kcGWPuIUUQ75zJp8heeOj4uiXJceOnDtuToqJaxGTlnCstO8ePTdZezr5mZRMGR40fF0lHnpm7nRSRkVcTYE1/QD4yKil0rLzzYyotXIaR1qOHC2lL2uEsOKKyGuKbzDHLXosAEBgAYh6AOZ/qdZCmo4BGOME55emW6qMF7GhWxNEwcJSJCajXYjDEMboYtqHfeQrNylboR+b9S+vBrIfzrmMVvUUjhB2bqdz9eqKjdEjDjzqTVz/KIvk9ZnepYm1XfxFTJGiBMAALYbWDJA5BI4S0zBEzYAwCE0olNhlBiwplAQY1BRdtkcygGrUvYiCoXrfSGgQwXIuBbzRjwi4sxqqdRjtFeBUHSyGQn0CpQ0yVl7F1Zm9hXbGKQQIecHZsHqUijqgihfHEjlyMhQpxeXJ9qw/HbmZZJDAIWTNjH2T8joyVO8sDKeiGHQkF0jCKWjkQCkgLjOTcSxAYB8zTny7CmfrTDSoWB5XIoY0FUmJR2dg2PDqSZTHz2hwYK1xUsQm3mTO6xaJ6Q7XFeqWq1uWxOQmox2KzapO2fHPLjVMXSievql8aXYTQfiUdGp8dHQgH5biNWXz5MBYrDxaMyJhgIB9BQVkIlkpUXHFydIs1WngVE40lWP7i3CyTzu0IEB3ui2bOlUK2imVVZR/O7dVhYEZbUdxivBPxDtTYK4ZjCuYUKUQjzOrbIiF/XQ+v+QjVJ9bv6iP/ZdzL9n6pgmzFXdG4TaOmRMxIz00dnt7D4Sis5KaulIzVsfL3LTLMzJDBrJSVagQIBChUqIzOBBCVLCM16QwAk+SgdHmQLAayiQXrSoMgWeJQdRFMYMDpiBgiEyV22PuTACl44BBRtCe3Nt4XSswTAUgx1Rxnjc1LofdF7m5sHZnVQYUoXZSROkhyMM9Ye0O/FHQ925RRpGAYIqRwkqGWzrc2lz0PRQ0xNwwzqQ5GwVCwtkVSljnQg/FYuFprgquUyFBFPMlicXLHZ7iA3nWhaXjWhMavb9qRCGzTApC2K1CDou/iv2OePp4TlJip06qtih5GzlroYgTLSCJKLg8tTOXuCzyDloCIdE1E4tDYb/+9JkcYI4GX3IW083omWM+JUMIvZjxfsjDeE1wXu/YxQzCxAmweS0CMF5BtckVAEIeGJ9Ay/2DtCQ9G6lqlkHIESCyAiACFhUcSwwIHC+TMzP9zPR69vrJlsZzN32y6aJCTbouIzOLEfWQxAzCEybGNIEj5voIxqMx80DJUgJEgAAazN9yNtzbzhGaILnMv9NeWrb0dFRk1YQIH2fB/V/lu+XVn2coAEP5lxCBjEAAw0xKg4Sg4KPQaaHOkhpwiYkUpckQIBgkoFXDAwWWRmSqFM1CgAOBi5S8qFKDiiz8spT4BwSChBPBHRjLKXDWsvhvL76Kro4kw0zQiKmCQM2sOWUkMOtu4BoIFALaIRiTWaruayOtAzkiR0AOOmUL6cMYClcnWsKpBiDQIHhtOphsGukgKfOGZesLKYelNA+wQJ0nofyD5U4csn2n13yh19ZZDsM0b7RKef99pyC3SlU24bTX+fiHnmmJJRS6LwysVUUZhmdxeWVwqVMozCeNNoy1wJGEMTMxhC8qiXOnjPVZXUZMoiDYWzNZImVUk60K7FLTxgqZ9MOMRPKpLWoigSTi3OKK10WJsTUlaUWITSqtuL5qqwlTMgAvYihhyrlrMue1xGfqX8nBBrwg3uolYAIfwCEFyXp5PHKAgOAuFRRAhCqzHHEmjy//53IvubrKj22Oz+Upv/qcyIT9PKlv/6f2b+1/Mbp/1uuYU8ivU51WRFMjdFFqoS7XAAAA1jBRwAkKIR4ZhJZwRwkyBmFotg4EFvglBEBn5KmsMmg9rNkEzxOyzBujJpx7WFxlTW7AUSgahfx1WGpizbZoZhprTclfvS1mTLAvK/DBlBGeqDM+adDb6OW8SxlAUjVqy5wnBikBbgOGV2sl49kExkJj84VgalGU2DtCaK5yfjU3vmRRTEE5D0fD1+UDHyAuZ9aWTkpG6EZRqbefpnS6eHh6qqjRHzVD9+6ertqPORKli97Uvb91tDtrnYYGiUbiSy1YrnrqN5FdLh9AzVGhRXbYYTadnqle+qXsO7kRFJDB6LU/iQBPKEcGjI5/XsF0NQBWFJJVO/MfkYrf9A8KQXMrzz8jFYgLyFKohMiUwZGEiEyJhMKgf/70mSOgiesfspjLB/Abq/ooBUntB9F+SCNPTPJoLfi5DQKqBkyGzppFMwLKN9DRaSHv//nf+iaDBekXEyBnzP+Y3nUMb/2SjN/8xv5cq3l1N/+e38dUB42Uz5xr5YuIoXLCORURm+KRIGjtFSQEA5BMwR425EwYYDBjGJjEHTCEzECRYkIwY61LjlgUYM4uZ+U51lKyshZo4UPFz4fLk/MDLyVnH0qCYEwEoUiKEXOEkSZMkOY6hbV2bC8Ss+DsMtvYiSEtLapidMhcxNkwPQXUu7LKZhusZQmIUiIOZUK4sDgwvjpbyxOSnSSWUDtFq0znRy6jIltikZqyum+OyTwVc2M0sDShO9sRyaJaem3IUliEyWnJqrLKcRZ5xh1sZPJs1irEU+J0OnFuhIab2U21q1uy5ARwogeiJo6nMlqzqOCTUao1cDBAPL0sdq3vVTRwfSi5VthKCujqBfCzsdTKf1hqYAyAACjixVAK6PhQqIbYBmSe/wvl1GCFKjj3vkcJov6NtRMUDzj7nD6BjfApWJaGCxXvJxCibyz04m9//zxtDsCQz9WI3zN/s39W53y/Rkb0bznjKf7fVPkJ2KtRvwoVGUOQoRWEm6iFStI6WAAhvFmeafDJgEBEBnti1ggRBZQV0NFFdwJYTRBUieaW5a0WwXYtiywDiZzFPpDFE7Ogb5zkMGAjRdBtpwHMfJhnUd5UCyl6JedJMFQsRWclJ5qKCWwlxotalT46VAhyPXBNBXYRe0akcndCO5crT+Oe6aUfRqMu0LD96rD8Yi2uLQu4TbzxjLhz2dbQ3V00PbWh3hOl9WMrK55Z1dHco9IMVshQWdhY1RF3G7PrUakDEZ3XUGzE8u2sNpoTDHgM757VspuNRy+nKViYpawHs1Jl1p/DkfUvBVeHVcOTCyzPp8xodHkCMmraW4V8QXjZGleWib3J4Lft69kf0YHlgYN4EAAFNw+dO/1u+peU0auDdDJhYRxQmwHk61sioUXIqQNMhRVtVMnQdcNx3LyswangWMD3mVNNyPruyOw9W4sx7bxRtqOMYgtU78PKAbvSRtYRfDmt7KWRAKhACQAAhsDCuBRMDUAAwSwEzAlAaMTAbAw//vSZLsACBh9x91l4AJXhejooYwAOqopF3nugALzwiPzMTAARSpwQCgYFQKAiAUMBoCYy5RrTV9O1MDgCYwDQSjAQAnLJGLaGYYfwQhg8DohA4MCcFAAZHF+bQsOWtDA1BwMg4I1YFhTOUDTf1DxIc7IYFKNxCCagQcAwUARlZQPZ2qu5olFhvIdQ0CsaWSy4aBWMsLcuR6MRxKM5kkM9hsMEgqEgwfBQBVFUyVSYDoqzsLYE7juFtxEKZj6H5ggChhIKBgoOqQsAppN0h9eiKLsNjjrwtxeJ2jK8UzRk4zHsSjKgVjIYPjB0bTGsIVyLDLDM6bO3aBXUexg8uSqaTHV9Tchd8yxF8qBIEBoYlhKOhEYWAUBQaMOg0DAYVskDXXzXfB6nOLwOUuhn8Avo06NLne6EtYzsmBgOGFQUBwQGMAdAwDTBEA0CgwCGtjwYGB4OwmAaFTVactdulbllWh2Nszlcld+ApdIntpXSfaNvzDEDQuwEAuikgNBQJlgDTBcB6g0CxgEAyIgQFhftqzQgAAlp4XcgiPPnK60pa86r+TbIqWJf///////uCy98pJAb/3ofnHff6ghxjsscv///////8wCARFUwtDkMENr0UdmYo2kOVk3Vl1DeIDAYTEAAUAUEGGB7ln1p7t85jFC75tPvmPsO5Zagz0DmfWxcMBxm4zjaiCFcvmQGwAG9oGsIW8OtFFEt02ijlA9IYp1u+bqNFEUREKFoyTEJPsx5N2QLjDsEJBojNj7GbbX+t0Fpvx2EaJ3IqLLSJArmf/1PMGdamsN4ZMXIISCPCKCdzhNjIDL9/tS/+huzLMBS5fPk2QcyMiNFxkQL5Fx9k0tl7LQOmT89//W27tZepBf/8uGI558zPQeemBAKXQIiwKSwID5Nd7jOJ/OB+Mw8NzSwGMLgkyaGz4q8OhjI1+EzCYHMgFEHAY32WTK49BQNMPEYdDpikKG4KpxVAZQMmQgidi1xLONHNhILMKNQqADTYk8XCHA0KGxqY4V0I1qmXhpkZYWSUWQlpjpAKhNobBKSCK0xEVBSGjaYyLKXIorLURLblqxYFcdQALhIiBDIxcDCxjQCKAIhAAUHK3Xy+SWEFP/+9BkVIALiWhR7nNgAIjuugbGHAAkAaMyXcyAAYQYJYuewABcbu2RG4xRAMCJTeQsEjpaceOQETJDN1WBWi/99ZSP0AtcobESfwLnxjoAZQJMCAxsYCJmAnRhAKXdVUXWlTtigwCo92Glq3onqNLCIRJqMsWFXWSBiLAIAxkREAGrcnYOgaxEMUzGTwy3OjdRmzdnBXREZAl+iIwVKluTeW5PAUceAeFwKEGABaRwIASoBA4XMBAFG1qmKBqCYvGlske0ZsrtM6Vtd2na7lFovSxCl9ksEuA5Lc43CIHpYGf+ieJuNJz6W//+tgEAAAAAAJQ8GhAMUb41E4L1S1MvvLnwlSgjCIcPDQucFTQkKDhRihQsTBwTKgOCETEHseNyY0MJow+jFFOYmROEcSCgRFjBkdMQVjyx92Q8ShuEosGxMoIxEmx5KyGPcxqHm1Hz61Q29Xu6Jays9evn9G9XWnTWdu5iHVYxWN7on9e1T////7FHAABzDhXMbIw1dGjKx3N1lQwcezs7DNIjwyMODEBKMPC8yOSURzDZJMhhtDcxeAUtAdsvFZIkGqIxwUwmSBYMSjSHuDUYENM5FLc1EVGho4HFNkNdMwAg58Anq1rOAQIVIWwDSAwNEUFokwDQC1ZWSkND5ngAwwFZl5Q5phiJhinGOKHCig7cE6jAKSJfhhCSS7kU1niySsJIIl8qcv4nQoUvChQ3bCypDgj+mUzBhL6M3RVXYy9tJElKtRdUimG1Zb8OwW3tmOMwjdtsk3Qw67sz2drQFG8PkmERisizu1aWvnLcKGtLcN2I1YlfNS3C1PcrWtcp+YTFC81DbjOMZdyBqaOR6U4yi1YoH2sTMYsymTQK9Mt7Qyyns9zyoIrVAACW1dRDRPMzxWo9XL7ehLKcU7O57O68sdFyI2sTzFmu6J5UtValQ1q2vX6CkyelAo27bvn8aZmpeY+xf1fiwmQkduKLu3LPWtPy0TJnuidEG3+sXYW/DyXdTH+n7Pu9KQAAHLyoRi7pjVAgZqGlgGAAMOhw3q8jcMINYJ81M4TRStNJF0zYTTLBJPBk4Iz29C4RQMiMaJBowGKElcYqBlkGQKXpcFFUvi66GqpU//vSZCaOCP5ozJuZe3BRpJnXBMMgI+3dIC5hM8FWFuVokZXohXgV0kMv54i0Rd5XSnSQrEWkuZNIoxWGoLachEwJk0PLsgxYFbqzkTZaw4SYGMATFMIUYhygToOUekWEuJynqBrBXNdSVHVMQkSVDlKym6TliVZ4rKOR4SE3S2gC0IkOk4D8VQtze4KE40kMJGvT9JypB8mKWw0kebyJVjOdSGzJZxTzOnEKLcqsMrKsK04TpUsEvulEp1K0IVs9kKV8I4WhrN+SeW8hIDrcEMEyVTelTmXQvkKiJOY4DUTDmuEY3EuhIUSc+z1OwwDrSCtO9CmFmgICAS7eWiRgMbrbiKT3PZmzXT+l5OCcGgWefiiZzL+dbX0dBSjFngRg08YFQwzdQIgkosyp5UTHKyRpI6oPGJ7JWgrlVuUBysQiJ+xih7wMkiEyGGTTysMOp45r8jZ7PODPsxOvjBZ5NdC0z00RKeGy0gZhERjgohicMRgQMOpiESGNBSkSuwGhAeDaNKukJpmWjmdGgbIkkAwdtWcvA1cKuBpAcGAkYGIvu67WaamXMzpMlQ5rpeEMIqVMWIgAqGoqwiMKoTiS8ZsWdNA2fgEK4FMpMXSh9ryE9pEuaM1FfCTK+pA+xQFrjlw03R5HbpHqbeehuHViyl3I8sdezQljRyVthcmBXKjkCNhus4vQ2FQiqA5UCSUNCChOiKsDzJk4IypK9No+VLI4soDxImZTFLDM214mhDBh6bKICEAEJIBMIiREg0VEA0QAvmEpcfQ0PAqpFcaw0RiIiVXJ0CXvYZ/n89nWf//1DP+oxg5LvAABwgAAtymcDwbFNFmnLL3AiJpYVX+OrVeHU/CkGP4sFHVgE32L22YLKwkulSsMTUxsw0JQQcIVsNDQukVABNLyL4uSqDWeXWP37rS0WF4oc8UwUftqNfQcwiWRZfm7RCcSD5nk+nIFea/VRqxkmWgGZjEQKPZjANgwLGIw2LBwFBRK0ClEYEEawQlcFIJchmRiK/lFi5wtQKgdEmEvhH5lpYGrotaiA3AvkkAgFbMX0Q7NbUJGzrICaDxkxzbIdOgjRtbQtAniOMUVTMR8jyj0MAR6YJEF/1ABwLL/+9JkQwMKKX9Fg5h78FlkmRUEwwYocf0VDeHzwVEj5GARD4DkzVPQA0aKhcmwD9CGCOh/jNiBDAFQAMk9NJbAJhNiwByF1FCTQH2kRNBvjDDDMorHAcauYVGfZeENOgmCKZTYLZGKl2eTCfqeUUyqRyzZ2d7ATBEwNE2QlXw3kdPoCGSLb0pDyHqVuXJpQ9UJtDNuLAhBljxsLc+U782jrYWpRou5IlCiS5ISk515dPm1laFPpjHE4mcecNVMN8qBsP5w1IyVjrlAms/VjJPpygTPke5/DAejPrH72TX8Sfr/84IABE0AEuw1AvkfPq85c9Jf+dUn+osMrmMdQcC19S6h6KRqCFnXjRUUUoHIAWGV0AZjCVYXD8Uq2pFBJb1+LWuJtDRYWxrWJ8WC71CMZJpDgEfdD1D5Zs0q4BgQDa6w0gILECYGenlGBxdATBxnB6agtiQ+YWcFQiMHGCJoFhkGigCKyYDGkEKACRRZmGRoETPlq8H+GptfXQI2hSQCcmeKNdYGjYagmZknNAgOEJOcdTBdaryqEueulJ9t2JJKl8UCRbiwpBmj1tKccaAjatsLHgtKxJ8IElqiqRLUsXqIQJEKalx2SFk0fScAc9zkhn7YdDy8kMkN5G4RWKRQQrphzNmirDNJJSMvd1TzmymKKdR2G3flj9IbdpYRH1Kunp5w103wmZbPtDlylFCqXVjLbjoSrmnUPWXTi+2O4hCeVqjujFGvSGaZG8kCj4WE/DQ15M0u2SyhvGXzjHGqrJ6c6kIP5pXcyfULKyIpkP82GJxepVJl8VBQockIyvZcP7qh/GkhJLLUiVI5Rs0dtp1aPqrG7i69593hn01bADJBBYSEViJDlTYgaFKIiQdAq16P8w5TQeT+lpd4gwASKBmIExkMs0GuaHyDTkQ8FSzid6hKb56/mt8Wpm6IuLDbzOZLDHH1IAtjWsUKKu23fkdbKgCImgQdWWYqgdtMbISdKsZ8iYdqFEokTGs5kgBgToWTlQaRLwqJEYBKdfagbuoI0EDvggY71A01CJSpzlhUg38d8KgSIRpLA0qVetMYMCouskm/7Mn1Wmu1qELVUS5TJdQvuDiIZrmeqMO4n09TQ//70mQ3gxl6fkWjWGTyWMeI6AwmbigR+RKtYfHJfjAihJCJIMnBWFZrAEMNPgZIceG+D7N0ZkrAFRS9vwsN8mjLP9kzVmlrqZ206Ttghx+VwQdIVHlLp6Ww+/zTWVSaxPOlGqaJMQEQxKpAODQdRBMS+ybtEsQmDZCfLx7HCHa0fDQ2qSh7PkLi5TjIPLwVOnbkgv0LYjpb8RB1LhKNzyMnA3XlxLCnLluC1ePgnHBXRls7UiIkVlOElnhnGPik+Tn5fLVtZPBJYJTDYimZ64hGBTPHFi10vom4kOCiI3iWQbEzVcDYWAAwQqTptUz2aVh886KKcKvCt9Oiq2sm/m/ux1fMnAVRIklKOozy2y/lNrPL5p04jnb5PL5BbkrdQBlpSh1cJqVWMj5l5kWULdDBj3MaisVvujr7Lz2MAgZ7Ma10b6oZtaBr4FMCV01G41xUasovmrCmLFpDCREDEzGkwCNU7dhUahRA9I9pAoaMQ+iKh4pQQHC4V4hoi9Q3VRpWlYN2FXoCS5c83R/pemtli5kCsNTFRqcZsZfh1lfL7hlShpysy8GvFBQYEt2n3TOkmVONjSkTWjDXGUwYuV4EembIVxuEuyyJ+qjytzZey1tQwf4kZfRFwaOQx0g3MpODUDLcUKJ0PQQdDVgWJaPOGwqZcmjKWIu5PlwZS7hxzvhnyoi9OpRHUMVp6vXI6IBfBvl8NVXNkQ3Wwux4o1GOatLkTZDUWWNyUb4yTLjujmP872ZSjckZlE2IQfCnbyWwkKOytD2LZ1RooGNXGSr2tcn4tNSrgLDAqjgMvKsdHah8NLsx8w0lIqnFyaFYbm2ZpRbEqG+p7x3JqiCGJC6i5rGErYA8CVwCNsiGYbOeahjec/zGMwE6XvoGHo1tDGOnRB6dNZzjcvIcp1vmYermZdUNVm9GZzZRm56u6ErorOqVfGyl0crfqVBhVPit6X0uUYPUGZce881Y0cpGQAB34Z+AGIDxlh8ZGWhcmM5EzFi04RdC4CbBA0uDYhtMFElw2tAFCKtIJi0BCiZhiMSU+oSjkqZr6nlgEOCGaXKoXJAgkqE+FrMoniKMpuOdJErIWUykIKQEtol1IJM+jDdEXMtj//vSZDODmap+RSt5emJXZgixDCJspUH5FQ1l40l9oSLUEQ5RUqLHpO8SQH2HASI/GMn6Hl92UCYRQ3R5iiJ3GCUHkQNWF4JSTbCvLoXmQv5ykcXFzLoVEJDjm1GqZCEFvejvZ2J2hBknYf57otLp1WKA6ySSJAwEvDQxPvmAzzthE+Wksj2xjUZvH4yr+z/QxJppkZ5DGV48lInjCP8/TsZ4igiMCUO+i7VafHipUW1l1VZvuLtLoSjI520VB5pIqzmXLxWP7k5dsTU9cGJIJJ7tmP94r1ybzjCulnBlqw3nTp1ODprPR5DlVmHdIEky3BbQCs0YFBKmUJ0P7bkbqYsBcHO/jcWp4zuj0shb5Tvb00LVOoL6jha68JBQmLAy4BDlEli0XaWWRQGiQVAoFWf6dUWEPLvppaLCjhdYaal5Y098obIgEUCgLuiDB+6cgIYcIesBmjljMKnHO+YqBCuiMTHGgGPDLJUNVUF+RgTkC83E5LeISK+rxbj+nSawHQTsL8GkKpELydJgdC0cyeWoZjocX5FBbE0LahxnHWTwfyCMg7grxaWQdiPXSLJoGGUIb6HKwyly3ujIJSbaEFyVw+mYNkT41CXFKjTsLfDTA5VIWCYaiHlzNgtiKQg6ymPVPtjAvo5Voc3q9PqSAf6YcUoqVYS9tWy4MCGl5coHKp0njSSynW5z45hrxbSxM60u3B4uFKzpsuZ+benHFZkUq0INppdochrE1q9JN+igcEMjq+Kq1cXtN3YX6pQtxKZApJio2Q1KlVQ4pJ85nwxKxthOSlgUT0r+ZqZ1tTPYzErdrlabKv4rSyM8JbY53rfKvgAhAE8TmN4ufTJoOllX00+Lmaoh5PlP7TpOLILZM9j838w73+wsz3rGVm+U/Iua8MrlMOnnW3jqE/QpgOD2eqea+BA5y/8kJMoM3sms0vbFg2u3oKcWe2zptol7PXckEAbrgARmABAgM7ojDSAgI9aJOHSEYoBhlKGAr0WaTiTNWqkMXpLipiOWpwzxS1taN0vod4ZodCoIaqS/ncWAT5Diel+J+ymU1GDI82yk5KsQxqEhVDAcy7b1StFzLBOh/XJiuDiaTOjGVQvDPQ86C+r/+9JkOIMYwX5GIy9kcmXOaLUIYswihfkZDL2TyZytYuAQjPkQQ0xXofLOdpKlSm1azn+hKfYhNEgfDIXmA6kYBBURFcrPFR6zBs/GN2iA+NTBksUH5yIheOThEcGvK0hbGgTi4jspxSfCkEyqfLRAOn175yvH8MxauJRQE6AhRnhLXIimHC4ur1IyPAfRj06nh8WHBosHhDqMyaJBbOUNkvQoBEPYzkvlVo4PI0SmB5h89M3DVCWMnBSgWqLIC9xLY/iN4nEhzAhrx4fQAF7otWpbrnaj0YMqsLctSaKvm/nMol29Sf0hoBCxXoL+WPYSkJc0emZbGWjMjkc/Q86jb0ICNHIgeDBfOW3hGWWPudTZuw9+FZLM0iGJtOqK+1nLdnOze7vtrb1mJcPtm67kUNt/qFShlta49gZdINoOINVdZYCoNAgKrA5wkRVTaKJINPQeNJkwQUTmts7VhZfKQAL1kOyY0jmHqC/HaXg9m2ExoSikUORkRmEIPxIvVcqyldNqTRa5Osvh8GorlcpaH6X9VIyEiTqLdcyFkyCzQKWTZvkmOY/BcmE5CLL4lidKhtTLmlksjlYTI0aog8YytMSeVOl2SKhWWhalJPnR888ISCRzxOyTCZwiLIB1N3zaytaQyUcuKwamZLQ0QkpzgdHTMejeIpkoywSk43KxyNwaIKkxKporsvK4njgsx4qD6IzdAKmxRgLJcVqIE1ERyqsykL+jg2fJn6ydldAs8VnWHG0Ja4exOsEpehKVjTjMdmYoqABHEEYXCQEalLXgixoVTbuv9hGCQ4aymfHESq65LNUqHW0ZjQ4lAr5tUNW85VhKxe7dq1JS48aaHLKjkkXyJOUyKPv9zaWH+RCc7Eh5C7NnjXUwUQTRfBLpqHfyzsP/h5zJT/g3bcrVKnxAAAV6EEgigwBjRJMwYC8hHRitncAArEUxqdQQEjg4suHfAwDJJfHjdAztjAojmaFESst4pZOxazpV1jkJYSUqhNBXTTPKU6i7lzSS+xhRD2GAe5MzWdHKXtDGAkijiuIEMHvCdnghiuL6ttjOLGxo83Jg55TyXDeIkvuMOVELDMd60OBzXLFRKG47wkq1B2obFRCSPP/70mRLgbg1f0dDL2RwbO3YsAzDsGPB+yEtYZPBeKljlDMPgsrCavPkIRBKOzo3jbebEpXG8oKi/XkTK2FWmhEhQnHlZGerrHj56XWSkXly1FZDQ1DfPoDFlClo1rxzq0TF7MnZ8ew5WGyGuJMLDC9afQr34n6ntXbMtIPJdm6EfK0XVOjh9vtihxZAitpllZXJXq+CRzD9EUz3dChO5H8enetPwCQ6Dz4WFw4s4Sg+I4pnRNZTSgxfm7GTx+JQ+YZzP2czY+uSD/08HJC/zv+f+kLyWHl+6AyODMRur7oUaK3xFy1emTw+Wi6RaTnPK3aHIk54yKbgv6xWpv7dfnJPB5RgA4Tk0cEaCGvguaYhcZwyGBDMjQSMN9HJogWJDw8tqvkWJFnC/oyLdAyQRKcKEQqCYyYgO85Rec4KXWoeCsA4QByFIi0y/ZZ9NBONeaXjIi0zBCIKmcubZO1M5pzzFs1OGgIVipbiRihr92nNYMgldkoWt1WxXL2sPStR6TfSPU2cGIpuIBYeaVAbQZc3JeSTLR2BQw0CRQDBzOaFyoq+ymrTpa5z6UbUHpbI+khsTVuMiEMCwsLRU0/KsbbTqqU5OL6tdAOjShQgPnZu2+/AUk8T1U5NjMsKrhsxx3sJu5RMcMN8fNrTCiVxbkBudqYUK69beus6Xt2qxg4eYe2lFjjcLtLr48rA46+5FVqsMUxrPWQuwX279a85SA+50Au9pUxMOdJJUvllrkcP4Zgo0EG8dwz2Ud0IOIsdGOYKottp9P67WOq7iLgGHc2rE1zW8f5rfnX/TMv6ZUs/OFDcv59zz5irA6XaasYLPQhodbtU/snlrP/krFplTR5sAADQy2baAXKOuQKSmWkMOG6kYJpzjp+C2yWQY0IQ0DAsYZCCByg4UjX4u5nL+qxVlK3EV2yhpUlmYWz9VZRyWPRHIfsy1pTCF7OhFn7hEug65cvMxj1C7LpPqwh/H6qQ6KQaF8SG3ScRkAnKC6DErHRePh/xcbEgf2T4fVzQ1iSHR+tWNnA5KlKJE67jqGse93nmlTtl1dO0rPMOssqmbMTrELlFbdG4GXGHs60p5olq8aPfrrKp1iAyg5y+xrsdiSxv//vSZGOAJzd9yuMsF1JqLgi1LSLGHUnnIW0w3MmquGLUEYp53tsLFlyheeQr3Lze7qysFE0PRj46majCTF9b938mo04SQCt5UPw2k5qSr7PLv2RzarTe/qZv+Zxd1/A0pImNDciVInSUoSppX7EDFcZ1IUqF99QglL38zf/8+dQhoQgNTIP/WzcqrsV26Gf/DsoVcrYb9VSbuqYR0YujN1deq/Zul98/7cGG+kXoKejUQEAGAOGDJHAKmFQAJkY42CmwFHiocwI1PAecKuMCEZAosWzRdIgS5pNbeNetKwppytsMLuiEua02GGmsPoqVdrVpuRKbQO98FPO16Ow63ZY0g9uq1dOK2jXmTddd/oEqRcTRiIISpjVWJpwOyaAGyAYnqJ8Sm06aAvl0nKxKKK2xNxo/Ck9dKsFyk/EvO0CpmdplV41z+lmX+m7R9GsUwMnOU2WlyMAVdA4cRnAC5o1EKORRHUasOyNGHwaek+oE5mH9lIqunK0Iiysn3BrIlm9rYeidC4W7f7NxfrV5TJIG6s+AsWSCAQAZBEI95smsxREaHb1SIxDVxt3YwIKh5MK9TagKoYEUKA2FAQokAesoQ0fX8+RQQYNmfWOJpS+HZVSnrtrd5HOqdbFKiU12etk0fdiXo6mf9T2vvNMX671ZX0c5lZUKJW+x6B1JuaQS6TkkZXWHUjqQpTmLN0M23TKZMAAEVCjBaY45RZYDImAsbIwhMEgxwwamJQ49EWnCgTgPJALInJaLALwug+lVkT6TLii0f3AUs2Ljk5JBaVji8TxyHAsNKWmkdk7B8DZUorFjAxHotD8buulZadNntmCkjYLNVFzeta+pJKCJIbiK+eE6iM7KS04piRvqrqV5GqP1iz3kThy6+jPmFpiftnPGOReyhXkWbs8xj0bZhtKDSUkUWUaTsczFVAvI3msGnDbUOqziR7YmpWtGK2Nrp7Xy1ElIYru2ir22Yv5PblHMW97CuzKVJzHgMMAAAoSUSlErfVn9WSxaI16NGQ18vTq1cyP3KJZVUIaIR6MISg4mq4N3Vbr9IizkIpciz6bkZ/aRZV0I5DpoW/+qf7WQ/yv9WV1+s+h7bMNqxDOgeGKxR2P/+9JkoIAXO35I8yxN4mlPyKgIYuZdqfsfdZeAAcg+ImKEUAFFOriZ5CIR8Gxp1d2Igo0wNsvqSsAFGm0+OtKEjqgm6YKqs5QugCAEKlBniMpKq7E1gUEh+pw/gzi+iEQ0KOEXC7cXxCRhmod7EnjhZ3BCFdKbrkxpmOrmSU/0AxpHKMOiqLjo5ujxEnCkbJlyhsaRwj27gxNsLT+PFd6irNfEVLc+ak8xWYX6ykJ4srt01skKNDvhvhT5rFiOVWG+2zMDUlJWuBEo+pmJCs26jVeUn3JAhPIEGJXt0aPqfMB6+iwY8C8J+27xNHnbJK3ce+xJGfQaP9P4bbRvao1axbvMU3Jl9XEsOFPuPm3iZ3HjYbIcGSk2aWls2Qrvq2mwAcoCBw5bttabKu+Zq66IeQvN/2/0E+UvlCJxAQM7ts4ujixBI6mIiqZjJKZ2md0VlWVzsjqyqInR1V0jaHfyJ/9oj/RkSU56KQRdXKRWQilMpCsYaqIpVsZTsKO6simoqlJIcrFMdjohEFlK8hFONRtIIwcgiAZRZwdg2EgsFokCYAIPMPgsx4BDFZLNXjQ0MpjNJRKwyTF4WA5pAgH7aGY/ARbMIawYfzHayNtG4UDwYIGDCAGMDVGA2BeVuBgKRATQhGHJbg5IA5ScG3iEpMOA0xEFQIBgUFe5EoOHjiQs1JaCFBhS600xIMAw0z0MFQcHAoXgE24GMzJy3BmYGYsZNgXIiYzBLd3YbeRh62kz0oTKAIz4SMFFyYCNjVwxzkC/XRR8SEaY4LhKBraXe5aYDuGNBhq6qaKLgAANPRTOyUaB0qpOyqMvHNPnDbOW5PKspTGFOFFYvHjRyMVBBIMMgEgcASAwQIMKCkDHTikqfpnlMztjbgSqEtVhqXt2fJh781Zc5rKTEApJh+2SgEHL9gYHQlprs1LVyuROVHIGkGc9al8hjEuv1Ickb4ZTeERgh3opGo1LZC/SB7NF5rrL8IC0R4Sl+ydLhaal6fDA6uc5Uxp+58p8P5RfX////////7Zyyyu29ZVr+XK1rH///////9v2opDwOs9ShzC+EZdctmxd3IXSMBgSayRnWVhoMhspMBXxRsONixpwylTy3v/70mTYgAzBicl+c2AAmFEJLce0AHMqCzs53YAJszHoXxJQAPWxwR13WE0BYIqQUfU5UcQQWpazBYbg5hLCh2Tuz0S+7p9L2SWmbjCF0pm9ere7poKaX06aTd+6KlqdBtA3QQOGhupEzrau31NUzprxKDpTMCUJM8XzdX///9vqKaZuSh0vnk2UdTSH+329f//e7dtv//kusdh4ehKLICjwwDLAAAQAAIAIQSqmR6cmwYwGZiMm/xAmMpnGfZZHNDQGthTGQYXGLIYGOofFgJDYkwQoC5kmbZheDJgMD5iUKp35iZoaGTlgiQwUdmnghlwOag5jqMbCTmhgJeEvqmKrKZ2CmXrAgFQcYmOjZqgcZmGmEhLygwif4xwGNWYTCygyMRAIUNGxkhUYAamKhRhI8XMFhMwMgMIByQGLVA4tAgSBAQdBhoZMZFCAFUzElQaMh0gCguOBCd7ihAcX4h8HE4jDTCSQDL5KEmChgFCgQMF7ACAAgLRRThd5nDoMjmWTNwtkIkJGYMBUlWClQBURdsCAK6S4CSbB0Eav0AxECpXuPMMlm4w6N5wnRigiAWkFzWmCMAWstxhBeFrLK4cg5riQ7sKaseYY01obotx1Sy7N3tulSRlsDKYi1xTFnLcmivxRstcmVMBfJtH9jkCL9fp5GrOO7klfqKwzC7Fzn6zjlNI726WpZ3KGsyijdqXwDSxmDJ2NU89RRv///////+KQm7SVZZDd3lBKpX925X////////lVKl/tiAAIQAAAAACoqRj5CHEVhhh2oqbxi7s5xW+iFstWkuR0QQOxb1S8QmzapIroRbFyl5JNiMRmF0ZRNGd9exkps7Ir1Se+r/perq12ZjsRqKh76lJKhy41t9sy0oEhceiKIFFhEALO3gWz/sq//dUAZAAAAAnQY6maAbzk1WKaph1nAaIOpIHDICWUJbKJix7JxkAtSIUPYhsXAdJTduKW0EJjlwEAwCakOmqki+5eJSlRl1FUVIs6QHNTTKMKB0bYnIEgxJOFqaANBO4aiCPTGC+7GloIaKLKXNSkbMVhQoBdCLbSr8HQyyNgrSHJYkzhpUDtpDcnhUOP/AsWgZlL5Uzox6adyw7+//vSZE0CyAFoztdnAABn7YmW4ZwAHoGjM609M8FuHWVIYSXwGnobWFQPM41Nx6a5nHK1iKUeWGVW5S2qa3FMOX78TjNq7WrYTO6WxDtWT43JLWqSGvVtfLI9W+5T8kly1NS+XztPatRqhmsHwpIEiE3T1bMARylg+3ST0/ldpaeHsbcM6pZyclPIAQiQAQ4YOAkOGFkaieqqi+zZglL/Ozjv+n+pvQ5/9RGB8AkSThJMUXDoPIoCMgNhkKCSOBomXHxuC1SaxoNzMvYaE7ESjvajKahq0U9VR0SY9uldL9Wtof0erdnMstUWyHdv99fxx2kAmItAANwxaIrThVSBEJtAplJJmo5gixoBJvBhqzRjzAQaSsL9ESAtGJEhQCteeeJfz+NER/Qb0eJcBXkuHKWEZYEiCmNtIAOzM0oEv7KBhUzYpVMXECeP4yVUzi3A2w0RIwII3QTROCTKg8AD4MJSBHksZLtQD+gLlEsZ3ncZRcThMZwN5Ol1H8jmgtkCiHJ5LplDkg8WiRCxLZxSxNVrFZYt4z4LCqCpxQeE0WQsJzhWBlCykmAW1zSxASiYCYqUmIUQwaZBESTqSG4EnmfIlFZAIGk8NHcZPEqBYJHA0ZSXXFld0SCcXWNtu1MIlCUFOQ1NUAAuk4lBRfIvP/2qrihuX+vnO/8Pz+c/kJD256YfjlG2CU4wFVQJggIjYhJmUjbNdF7QqxkqKl43D55pNtCoacSUSDoaesk2i5S4NJ08OoguPYUupfU3cR5/WeUMAAm4qnGQksgxcILkhtMUETnBDCCDSBQIaMsMMALBxAGBQICSFGhgQBV0k4sMXVB1CExhkNNSJeQZCIgrZLuhgFNigrH1YkJz6zTM5xPAtSWuT6LhBgmRtPWHiywBfU2PSQKoRYKbodVhKlqJ0LSzVha8l9AyAZe0MSqEMia08S6IZbGsJGZZCVxpUtQdxIVfzLnmc6LR90XRA6VQCgRJhCk8MVasbE0RcCZ5SQ10I6k3IkpVOF2WOiuYtPvttuLXn4FrNrOuL0TkC5pYyatUUUeYODtNx0fQNMOGTCyxcaZqtYTY2VMUVSmDpir9pcjPXEVcZ8vn0bS2Zam3TMzNrfP/+9JkgQYoZXpIq1hkcGataSwMwsYgpekiTjxZwWYZZKSQiWiKcrLUzMzMqplxQAIAAAAAAMKJJxnQoU1n3MqqqiKR0iFkQQlKUtrjJEDNhzzwMgXL0V6qp9v131Id304kmzaSJEr7IM8vJiGM7SpdELsial1+79/01ovqvn+n7IyPVmlBZUXRDNqYyO/cdV8GviXExUVjHokMEEAy8eDRzgN5S45BRjbEQONOI2sjjPINR6MyD4ycSjEgEDAuWfMMikwWFS5RZMwKCRUBvUXUGgSXBQAooFsC0BZ5BGWXcFvl2NzaWp93lSqNK2vOwMnxdGcuJqHYwDYPxXliIYKYPxxVaOLYQchxrp+6wiWglrEGqMpeb0LQuDYkQ7kIWR1J9jJs0KKDMd+YSlWE6XpVuJPFqYvqfW1OajeuYapYmVcxWFmcoTFh86mu4W7U5RmiK0tT+PNRcWiPYLddTaYYsaZ299YctlfDixorbLCnbqltgqrtCbixmqiknPOk7jMr1ZHS08KKztWHLakboczlNCMZ///R0b/oGKAB4gJLZFFYpFwbLkaBvEJ8Y3uT4QhXd4Pf5jOCdvVJmapnUYAId3WEUOcGBgbkjmZvRQYWOiOTQCEYxsif559zBPziVbVvcGHEwAhooJGIIMeTDQWPqR/6mAGEEAluGYGJk7YdKrGlqBnxCY/THNxxv9UdHOHBJZpiWZMEioUCjoxcOByMCAUDAKQxZ4wABShXiki+DN2dWWTvA76qQCAoaWy4LPIBSJbM3BaKm0Wih7JEeQ4lhVK4lSANFVE5LAnormMkWHZcjBRZOU8XZOJMn1X7GyR2g/i7DdXmVZNYkDnMnkCZKlULiqW9WQlCssqmuhbkpLNsVqjqGs795FYorpxby+q26dYmGC1J5SRksrk+5XgoSpWh7fuqVbVE3KpX2ZUo7mYVbNaGhTGuEU8c4jGhCFSK1CV2rdnrBUOknEZS/qpwdnFCYnjXVllYG9yc0UooiqWZNCN/HchPoLoKfEAAAHwEDBe3U4NGTdoSGS2apJer3r/8jLG///Idv/8qshp0CqRgBWHSEEAS2uHTKkm7SAx6fs295bPcw+pM05aBLLPpC4Ndrv/70mSoCAhHdMi7bxZwbm0ZTCQmbiG5+RgNvTkJxjRmtBSblNujbZny77pGtH913uL+MU14VXPr3WAN+Q6OufPZsf93pBnvbT/f58zMgNNWzri0xItNIYzPD8gYjazQy0LAoINCRMXIHEQ6Dh9YUHACXxfxoacCtZfEvarCAh1vguAJatURNawjOXNUk0deT1DgKn8Xbd0uUXlaSM4dYFUr0OcRORNTKVZzKUYB3BEjaH+Tw1SoDrAtIlDC9CygtSkNEMFOHZFblGfg5YAtsxbiHm8M9DUcXU1EixR4bMd7GPSfhvHOhJIjKVqtmTzGxwHTidb18WPz9JzFahdE2LONLwKplSoegwWMMiZ/QyKCRxwpqZ0mikiako2bZQpSOkr1TisYUvIVQbo/rm0T29XOkraaJAlN+xQwdSUlhhR8MbTjIiTbQQnNTmqQyRzqbLkaTSKa74rsjTEpLlJlAUmoURp2ZhyggyE/z8f9uv9f/1//WzajinRIixOAUlRWmgi/WV2I6RCEoPIdt8bmZ2WKXrUZCyuWbMEWSLlZ2n0flfSUoVNqnW1mh4vGyo9oJPuP3FNGWRMpSWxrnQyRRCki0EwlFBKC6WixGhKAAbPMY6CZ5EdU0cIUDo6cAJKGiNglWZYmY8kZdWAA5AAgkUBjoFcAWBuaBQiPURZVEpxR90Evn+b8sAkg3MbhDBey6p0SAaxyi2rhFJwn5qLQMEM0dxOy2BWMKmP2cYxlkoVLplHTBjF5AdUrCOpKDBLhthO5MQ5zlqfiqc0ezKiPMq2JPLteQJ1JJhXCFKtCWpjbmh83SOM7yz+Vo0QIjp0LMroUnVIkFZYMsExPBpMyoQFTLmzxxtETn1jaTAmbLmxCixBMnQh5pHIyH3h1cjECjhSaJmAmQkdlkMx6zwu6A/lGRhd5IZJiRDSIgMI+KSdsiMjlLhkRMqohRIuhRtHh1tKQkngUu2hIK0cADAArVM3yiUQKEf5o+T/izl2/qfy6P/82OyO6fYDxpsgJC0y6FwgDAoKF0miyBs/WLk+LgsidsUGlfFZyk6aIjuNbY2z5mIoJYbUD7BMFI8yWQJmTIBEVkghDgCWHKQxkODcYSXS5ifvE//vQZLyDCHx/RatPTdBp6Mk8BSPkIo35FQ09kYmRLmPgIw/IwJtQHCNnHGhtUkkGaIGOWgBMXsHopiEwsrZATExQWXsCooaAqapfu+oeMgx+wS0KAkQXJS0H4hQNAHWkxSBMUibiJXQ+aial8P464ZnIw708olceJLCQpRPsB2qAxWNgaHNkWDQFsQY+z0M47VYljLycK4Sx8IKkSkIzPD86OyQXxLM3GkzBouiEsdi4SxsVj5SeFYrLkrbh5DQ5Jjp3c8HOxUfuSGT91BJDzfo2zASob1IikwcwvlsqLTo9TL2m1BSNj8rlclOHxVJDZTcICRCuYGeJio44iHxkeIzIrJhxNDyM8MDYcT1xY4eFwwVkzlo5LCuQxDSuQiWsGK1JDQqIaEeCcmHdhaw0qK69OhJ7HR3AjAI6wWArlYszKZZldkTff6bff9O3/cpuvos5jjFCsfdikrMUWspkMIJlBekGk9ziaifMd8qGRNzYc2OE0zicFVSYvLKOee+ZW7d401/lDzJ95AmFC+Zw2wG2IL4vGLQUUja9vUtCgAEz8y80GJAQUMAlBQIeNJzAhACDACbCw9HRCSHASEelwKAHeWkNBkjWMwpwElS+xKHaBHYoKCmbuEoWgMecHEuwbpcScmSUQ+hHR3DcRKhJMJ8KYK8O9xRGRzmihxOhvCujpOwmghU42yemOaxTl+PdBnKlyzQgdCdSyJJCTN85q5VG+ZDCLOvbO9kgK1Jq8fBQIS5JtJM6dQhQo3qRmPgqyMAQvu2LTiY8LhwTwFlqceXFcfywfiUaYCGoBHPi0awsAUOleCxKPo0CcdIDKk7D9hDCJpDI49cTk5AcBmMBPIJLDsxLigezQDY7jwWzQdHxODsoiKQx5YKxmHAKhUE44kseHWhIaEc9uIC8q0EaJUQAaE5segaLRJ4Sj8qlxIelUaDstMVfHhfeIAJGFMzRnERSuIfITMWufNy//l/l+vDztgpV3vZ0KJoYU2YCWhezeYljAdBSliqBeoMov57HmpZNS6qo1nw75s6KrXvV4CFL3GjKrK3+TGY3cJReI/3do8i/VsVvfLPXigTwB/VGYOOnm9kdAw6EYoICaAwYRqMkCv/70mTTAylsf0QrT2XQYCr45AQjbmPl+RMMvZVJlLRiYDCOoTgs2psAAQMGOio1p0J01W4TrV0hFL4k3VMd/1SLoUgesbY/TSh0FpMgnY410Jmb56qA6VmMXJiLw2IS4jJfGCXkvSbVaEOJOWZiGKnzNLEuYKGRDFjn+pFIqEwribF/6fjqdQyQ194XlPmawmqRchACrDgpD4hpzEPlrAeg30jFw/EstkojPFqyEI+mg2hJiM2Tju6dDEdhueHJ+y2YKiISDhAK0Zi0PxaJRijQj0gis0R+TiuhjmJJCIhKeCVVSJaqgHk+UnKUJzkxUDMwP047mhy4CIiEofROPGGRKJg6AgtHsOTJehYOAekqMRR3UmqmArnKgnH5IAmWCyKS8JcJLP4ZM3AMAyAIM5AkKyER+nnfQ7TktPEyl/PAA00L+T6RMlWUTCmzoHRzOb2Or/xhXDl25l07GPPMmXkiJD+dVul1SyvrZf/yIVuho6ufm2Vh7kToZVGYztP1CxHgSX5Ydw1jzKHw1V8pmIFA5gAAPD0yNTmwNigywTRmKBTiLNpIOnMYge4QhTuCFkHyI9r9G5DdGgLHqrmZaw2OSJn7LiUqVWmGfxVB4OmKPgbgJom5+l+XCKmDnO5kJCWAuBjs2UUnD1H+l9spKkUnkLQhHKpQp4mhPYscektiHI+70/l4vRsnm3ltueKrjs9kIMU6mosMZmSKGt1XaUYjCYIT9sfHuo47O5SuBYVUqYazpx1tNHuObLMkkLs+jtGEAsjocq0AuLT4nk5Y+Vh8FxXbBuYmVYKqymCi4/dBiVVYZoa8eFyU9HYjOBGcjvZIeqxmtNC01GFZipLIWF8tA0qqUk1oRjg4H99SP68nEUwYMxFEYSVqoGhkOcSto0QLlYlEQ70EH3zcdBLP6AIAALkzcDG7w1ORyqTJaQgV9WWJ/Q36HgmqepFVRgegJuhgoK5parAWWpRL1K/BOjnjzl4llW7+PVRLDzW/JQYQY/Kd253yDJ8xk2O+opTrnKVRp39WfBtlYfUQwPKo/P4bhpE0RLDpAbHjQEYXhww4hIEBwxANFAEzhkeLlAaJIbMNBgBCes1Ex0p9kYwUyElLuFkh//vSZNoDOPd/RMMvZXBl7jh1GGIaIpn5FQ09kYmJuqIUMYo5DQQZmIIdo9hSDVL0OcrC8OJyUIyPI00+VyvWD8NWp2HEZCjPM51IklcTAvUIvhlGWgcFKjk2birT7tEJtToScN0OSKJikTzCbnaC8fno0l42VF0nCQvNxQIYYF4f1hwVmFYpHd48OSSNJM8un9gnQxIbK5SWksxMiFGVYz68AjFclsB4yPjKEtL6o4SFk4iXk+gnWXtlwlMlsqlqF0uMD/gdjgpKSUjHaviYzAfkcfjofTt5YQXiiSRp5kRy6DNYZ5J6OR1cfD8MYi4lM1sPQobwhrjQSkhREhL6M3iJiUwhobHawDDAL9TOQ5347l6EWDJ5TnoQj3en8r/8kREKlFRlYL8RsygOtx1Y2CNn5PmQOj9vj2+hCvyOnKsb/I5zHsRkWsynJIosHJIvmbs6PVBtTVPqd+RCeT8iwJUuAD8kZREd/GZtVGKZAAA4hUMwmLWAaOLRAudKgkxRE2QwABxY2EX3QJCrgF9UyUaAPYGuL4KsUYsY4xyjFE7MZsJiK+EfGMPtzdCBhH1pEjnlJySYihSy4GSm8I5D0KNIjbiejAzKU9UKRa5OVOR2Iw1rDY0qw/2limjuS/ASgtxRvEKHIa6lcENXaVVzM2o9D3NEwdPE+XBLOlQ2MkNEpZshJQ/HrapTyPZHwWlmZGdkfMeY5up5D1S3ryQVcBiTlITZOiWBSH+g1hts/WV+ZykTSbaIWD5L8/OUw1XRnYG+ZmgJJtXLOl4EFgQSllYTgW3FPtG2KMb5zHirnsFMKc52tVwl5VXexzMRBdXrEl3quZ214nbqChsKlkT8RpjRXzeh7m4xE0q3h4t2goAA1OZmTGOEp+Q7nSE5OWdN9DyNZCjmmazNsz8s4c/mjy0iKVQ5olubbtW9r9I3M5T3PhViNDNtF1NoQtOScX/J0pp0QXXPEEaNAXT+ee34YxZhr0sUEmeYmB35FLQH+YUOAMDBBs7sRDjWoo0S0b8oPEIEAAADkAk1sFOkATQbQ7QGO3Fzfy84ccDEgzcUOFb0UDCUoxImEReY+AGjmpj4SaYDmhgxdowcBMyJjOEokUAYAoH/+9Jk7AAJEn9FRWngAHLPyJWgjAA2uikOub2AAtBFIcMSgACCS2YiCGPkplgObcqGRABm58pEKg5gJ4BQcxcdSrMNI0nAKTGbHxIDEIMDAkQigsJlQPIhIDAyISwZeExYKCgWTBw8uln0gkZWdjIIqNL4QAACA19K7XeDgYx8fOebjRkI0oOC6AbYsKFMbBQEAAFVCIvsvJFVaykUvF/BYANACgcpGYPBvQgZuQvsCghB4LA6yXa02iv7EmbEhwbxpS+X9W08qjLBzFylK+ulIAgAOJxEDAAGQCq5buhmr9N5H+AXcUPZNdbZLt4nCZg8TkqZPIrhp7J1KAcLtOIgBJNsgQKCQHAyvnWctca32rqqrDM5a+hCm6zlJJb61F3Q2tddEPqKsOkzP1YlmwOXcaymUreXLWsieieu4AgKmaLafC7SsBBAACAAvGk+gTehpE0pw2VZdmKsoeNJhwb////////7WnchKwzXoeYo1pkLJG534k76vGi////////pMNZfp12bkAGg25LG2XKWRptm6r5RHNi4rGhMFw6JlZAbQpQjpO9DmLERhclCUccgoVciTUwXFIFtNmuzup4yAadWWcpBJxFipguEABgUgQiJNuksOzg0WC+ywfDIhhwchSzFcxoZvc1EGn3Iw4w4794tKh3Jc8ykdLyZLp0GLKDhd4m3tVmllqKoyrhJZ1ty8axaqKIOXt0pcIqD9AzdqYxwuNDwQh3///8EB0HqjFFBgwSh/Q2hT///8QhJJwdkiEaHYoD4uSGnIgDgAAADRDGAzpMiOIxSGTADeNru09OazUbEN6vQzOizRRkMAGswQdxYfGeB2YwNJlgWmIw0aSDmIipp7obqGHMthgSeZstjxiY0rhDCIAkwwxQqNUJBYsMHJjagYyAjNICzeCIyU+EBIa5LmSK5tZIAk0xFgNSBBJDMbATIRcoQjGC0DABnwQFXYyNlOWYjJx0zs2NVRx0RMFXxEcGWxxhJQY0EFAYaYZmOqxlquaAxGaDZlIUZcImcmhiyCBnwzo6AJyZSdGGmpmRkZZAiBoMMRSEABoCFDAwoqMOPQUTmMkhgYcZ0ADRgGAhnBiZEFGRB4YlGYTIwXv/70mR8gA72iUUuc2ACbqd5FsMgACBhsSmdp4ABjLRlN4IwAIIQqHoSErBoiAoGY4BjJsYeAEzMDgoFBQEAGTtKL4mYBIKOxQAFANUwFElU0y1UCEbC4GnwgFMCASYsgIoCnyEgBWQFCZgIIlMXHSBQAqGQgwUAS5aYmUr9O+FIOwYngkQsM5iiTIFitNRRQVddlEbSrTSR1sOAoqrtpyqj2MxawMAayFJR5pTAWluSz2ynoj6yRvNN415itMvhTp+Yo7i+Gmqwui6DRZK/cTyWlBEGstdFrTff///////rQkj9SyDnDXbDzS4cd+UO60GC4E////////Xepd9ZULpxm7GoIa9frxesAQAAAACEEpE69ofFXDz8nPdM3KzPx2IFfprQ6Ti/+VrRQgU+xS5seUsoNIIocdQlh1czQXi6p2hZaRpgcCITdXFbca3HfRrg2EBeHAwxqns3ptJMO6/Uu3xWILyjIqoK8OfrD4BipBwPt+oTl0VVJ6xEAAAaNbKMFIAipBkwLI1pQCnihmYhWZsgYs4YoQTAxoEOGUZEZ0BSHHceAGE5VQZ5iKcXUFcD4F+JqENICfgSYfaMHiQU+C2pkEZFkL8eotoqWEdR1iZWIUPwvYuwsp+A4yWE5IhtGKZYWgnaJN4V1CgYQaSsP5HF4IOnWdhHqUDMhbtxOQ7CRnihZeScn0dyINEeknKgM441THdyNy1KisquDqM/Q1GRFbBnb0ObHtmaK47esTNFppOwXOAyyJxfhriSE8ZsxZI0GI35jwWXEzdEgMff7bJH1pU7trZ5YUOuGtVRXkJ6xe+capbUCA7hOLl8Z+fAbLF6xBggCLqdaIqkJAAAABVFJFLJu3Xi+UM9vVU3BhzNB48eYiFqGV1hmRr7KpCgsECSIl34cBGkVGYjGbkNco3+Z//kRzLm1z8sp/3sLIvs//Mp/Mv36XBRbcSafFM4ajs5mxfkw6rZQ+7+mqW5dJQAC1GsIYeZe0qGmOQB1DvdBJQjVHnW8KJy9yd5hrOXAQiPYegNURZ64LEFK242ndRNZLFX5eKLLFcVfYmtR/FO/ORCzwU7KjS/HNO1E4Pax+GuiTkYnJPJJzYGdtoaR4uC//vSZDKAN4h+yeMvTcBiT0j4BMK4Hh3tJ5WngAnEvGRiglAB6QlmTp/K5fOY0lpMNCwaL5zQKeMFqXBpLqZBpBpmqXcjJhU0TIDzc3I3EJCyMkcQREsyFsjJySj6hcsgJiNlNhJQVIkDUJQSinSvtz0YoiUwoVc611kNQXFOOZS7REfbPnVGFGsSnAsMwHkLyFia6TydCUzftudV/99IZdJRFrMvXn6i7/4rva9p6rIEmkAAmNJDYDqU/LPM0uQhXkjn7saNRz1WT///nKR7WziF0eofdEmDowWRmqJpHux9FL3INVLj/ZE1IhG99ERDf/tfV91fddvpbT9r2n3Jc7d+qrV7DfDISk/qcqBfvsPtBC1271JSACx3gRlFxjwBuTqaJkTxqRQ6LElBMhMEWAIICHxqAoSpmPAFgz3Msl4uJqMYJYYLUC0Bzi/VZ/Lkn5lOClinOi3F0iWFJzr6mNUkiEo6Cy3NMljCo0/GaXzlMlUvOmmBlgSnS06Zp4SamZMuSS5pnMQhUoQhx0PTHeMbW7fxm+GqI8+oN41NXcPCmanSvcmBXv2Zva1e2Jppcnj1nmw+gM+4U1MsK3HpErnXgSY+dN8DM82Je8g1xNAhw9Pe5N75/BhNsTuTjHy/h40t0Y4tprvpIvzJJW9qzTf6t6Vprf9741r5rXOvr58vvPORvzgoXJgbdGVb7eoxX/+z3Y5iHGKq/NRs17lmcomA4ucXIcjos5DqNIcceMIHGQnI75GnsdkZ6na4md1ZFOnTOdCEW6EIp3s17I06TojIx+rkU7SVO0khyksdauczHQRH6siWUyibSMJX9WUXa/iapipINr+bygxAAEAgQlFJESVTGRwzQsDC8CQADGQdCgZQGUkGip2YSY4RmIlRiJ6cekmjjJrB8Z43AwKSSM9gTcWM5ssCI81AJMBHwYfBAWaIUAooGD0xkxMwDhYQBxKAipLgwATMdCUMC8xQImJhAoaDQ82qiqrBkHa0GDaCcICzTCwxYGFBkxATMqPzD0YwAzVWaM3BjysxbZ3AAAAQMJgUDDCfKLchM2CTMGkwMSMDDnxbOjIhi0F85dJTChIxgwMWCDGwNIdCSpkYGECEuSv/+9JkZ4AMZ4pIbm9gAKXMma3BsAAgtg1FuboAAe2u5/8egACLwwGBAMmBgoDLDqnV5CguBMRXaXLVvtLAJiJWZwRDBdJAMolDTWlkIYsRUFZOpi5KGrvUMpexvnml0BqBtDahK3epmaSaBrrqzyLq9mBNEhxnLOIBcB+p+Aa7jZyHGEOhQNzgGDnxduHKG/Xh+Dofg6HoYgfkbc/kupoawqwW/zXV42IxG45DdqrM09NTU+5+tq7QV9Y////////u3Uuc1Z5dl9fPDKWXc////////4lOfGuV5mj3MXaTmF6umXFe/LwbC2MRQpbNrrJDBDEREdIwNkLaXn7wdSendmd2Z+aX7JmZnL7endPTPXk9AkASZm25OzWZDM4EMjl+ir+e//2zDsbkL6EdVqtts2aOyasXuL3sEEuUxxIjPFf2WzjVaT1l69G/AuKp4eMox5WJz0yfuzrR9AsQKQwalZb5amZdPyMS1aEo5odDVEt9ZEdUg1MdWXMpFxkCgdGaLv6et27/W2jBoNAmChaExILDadkpMZAEBZhQEOjJuZKq53ggAL7IQHhsaVCdCoFymBJhpQwOoQEDwEQA1YUDAHBCYUqR5Fh3GwGgDAcVaBmRYm0wNkyYJtioHvgBBwAg4YzHUfDiiZKhDScGcHMJwR2ASDAkLAUADdRMKysVDYmDZIb6Ij8AIgGJBkA384Xx9kAkQJ0nysaETJxAzJ8xLpLjgC0QUQiZNpMmmTxkZnDZAwN5kVTRYN3iCY4xAAuE4QYToxcTKiC1mFBpbZVNN01HFEXNiIC4CyRMZMwNCQL6p9R83Sc8ky07IHFLu6RucWpNO5XRNzM+gfLiyIUDhOf////////80JnzmkCAgCFWKUiQQD0FkoSDdfr4j/F9/0hw4ThJEA1CSERJ4uDeF+oEwKQbrf//71BrjTFD8kO1u9//S4qB/UXA6OGu+ZSk68z/yrlohKbaqsdUuRX6fmVLHu9xdBoQDkfL4m7mvj/8lZocNGPdxzF2MrrhpyLH/E/////9QIVkABEouJwlgMEksGybYwIWjPkWQnmLg2SAYRgg0eHzNaAMDAlBC/r/GlSAMl8woA7cNNJNbaNqkLlL2f/70mQdgAk3ZlRuc0ACbK0p4cecAGF5oz29nAABaasm94ZwALmxEMLmVlHJcCIGYQO1xkTeRQ1NI0icFDTFjmVF9W5A4EwCKP8XmM2PEhIAQBRCZICYUUPC7z+Q+/zqLDLtf0AC2JLElABEJ7p8UirnpSqhb/N4X6QFLZgFChLVHpNNm5clVJrUOqjpIpEGlQ3QU9pqVqaaC2iliKqYipwqAbqmI50ffXVl9Y9PxGQXo19vH714aEg0AMh25oag4EkszteqgL+V1yxhyYcd6OxWCpmzYlsDZ14/U/tu4uNrSqrIGCsCZeu5n72rFgppbhPTJIJhmUPrFaSIzsuzjOFLS95ex59reWWf3LvEKIbOAAEiigXB/tUlcfH224Ws+CMjXMTXC+aPD44JhQTi0aqbHxaKhoIuiHeY9RuJYD8THlTIkM88RguXxuTAUWJNIjxw4Olpw8I8aDc44ZuDqLzKEqKxpExGa6MY35rmVdXHUf6//9X//r///9CQpYxFoAAAAAzCH8lfONo/eToDBXIpOZkRr/gvgrbN8AlZBWq8gCcIx0wV8twQqQTLlAzXOUGaapUq5MFaS5goGBWaMxf5N0xBJSF9kyxw6RABIAip7AYQICulWF1kOlOCBpIMvShXVXb9SsMoXBSJgRcgGMGBXsjyv5ppb5QaMOIiCvRIYxmlLQpMhNX4ptLmALvbPDU22ZX0y5M6zmoxeWstlr8xdrDJpNIqsNSuYrWJJDtyHnhf2vbrtNs5zmv5DVe92W3alDqp/IFjDjR12YpA1JD12lpqsV+zLqbVuVT1Wi1S1YegWg7ff+HIagaUw1EZTKLdyljUZ3MRa7H6R+rE3EZTYoq12xUsy0kEKINFsMBe4YwZJEBjNmZmZnTVMbo3oZq44x9TzL+hj6HFmqTMI7INGMZlDIbLuJxqhQHwpDK/r1LkTh52Yw8cPk0VnQma3foX+kx/ezeef/yg8/6EfkvFanqAAAAWYJJhi8IGJzuZfa5lcRmZpQAtoaFPIGsxlcRmnwGDgYZWFBWHDCoHBRWMBAMmHIkGwoCi/BfFGstEpeLBgtIPRGgpJypDGIYKYS1JRdKZ6xSwgwgBIXuQbHlKIo7A//vSZDCGCJpoyrOYZPA+ZEnKCCNsIzGlJk7l7wGNG+Sk8KXYFBFKHBAUOTGWmpGNCZsgFchdywhjcosmmv+AAIVpSXSR5ouBrDwjEcoI8UHyOllqWqeK9nnQDF8maJGoJXXXzE5c/7EXddmGUymxoAX9iLnqXLuXs4kalblQNEndljvUlMSoDeF8srUzxyk27FzHWapjZLRDYKgHjonpzgtFJfZkygPoDqNe8fqExfOX3uSE5WqLKc1fRr0h8648JS19bqEZRJT1smo3XHkNepIRzZ3/iYATJSAABLk3BBBjsLPBE5pxYLdTvKWiLjeZd6u3FVTCx4cDZqEnoZE7e+WBp32TjOf/Z1QgYu8wyYdyMKvTWC5g2MZhgH5mkYJiIShoy9xx2hxtVbJuIDBp6sxmcUpggdRmeaBimP5lYMIKKQwrGAwjDQwlAE98gf0Z2ZhToDCJ4dACLzEHJhi/DKX/SBDIgcMVAyzqlZhKjTJirGuADAUgGIKBBiAfl2QS7SKAJWxoEthvoSagXJdQ+ksAHgriQqgDMlysFcFxAKyJG8nwbiuHEQJHkaLEwrlnG6eAXxOh6Tx0W1yO5dmGdKULiqEgOZ2kTuhH8tPoKw9cY80RgYVml4q1AboB8qGAzsLidTHFw1wGes0Gzxz210ZXkiti6w1w8yRmSGrLOV8QrSPpp4bJPViTj10hKy5sz9OREMU9WaJCwwvUw0scq2hCdZF27y+sMZStuIMTgABJAAI4swm8FUBiTTpJMqcMJM0tJTC3DMLNZh8FFZsuYlEsi32hQ5/GKT9Nf1ViVZF0KPraGWJYjmiPbFa0STKK1/TUvFn9JP3/0kOzFP+vL/mvyU2RDDmAZqb1HmMZ+o5EtQAYAAI3AmMRTxZ2GowCtRjAkaurAE5Nr1DHkIysnMQGhouAAqIQIGggCPi/65WhDAC1gqgIOCW5mBA5QGO5BCNzKi7T4PsgGd5qDPl2IPU8UfRS1VokBLGYAytc7kUK9y/0FrAJHMWLTLBTC8l3PIXdh2IqkL/MDf1a8wq9hSwruxF4G1jKvaUYglCap6oFIHIL4715drguxKjQWFiVEq8xDu0m0IbWKEbsBrY7bjJELaT/+9JkWQKYV3nIQ29PkGkuCNIlAp6fdfkfDL0zyYWiY2AhithMuqFiAjVQzWWPUcyJ0aJNpVAXAokI1pEBEigqqrIhPmkjMD51hQRxWFCFuNmSWZP6jfkhJvaaI6oYmkQR8lyi+kPKbe0GyBeP9Du3/0xec/+kzCs6ZaB/IQAAFyRiklwQGhECJ5SMUlyIz6/////4/KYPqHGUUq///y7M35AN55DsPcUvEKRYdklqdHyHKCgXkVD0VoTRBxxrNwhsJL1EaS3kTo5G/tnT6m7Ggszt6P6r6/t0InXlzqUV/k+CC7P8HxEskANrFQM/hR1kg7bkF6hWM7kRCScRYJIApwOwUVApKccNoXQ5KlU0cIMUoZIhKfLuZRIi+noPdQBH1ihWFmPGMTxnAlhCVk0R/VTonKeNIvAtZ2k8MZGCdKlIq80i5nqhI5ywFvip8lo9ximgK4/YkuxMNTi1QvzOLbCPWKvsZoznK1p843BWJVodQ2JUs0kFWNL6PMv3SBoe5Y0KyZiaBMk5APkfJoISKmxQaUIkZ2JXVUFF6gJ4kUChMgnKCNlt1rsE7ZtLVkapg4Rn6fCCKZUoRTZIsQyUwkLxSXP5OBteysMm5eRucO3bUXv6I4579TTYZ2mX+jaEqhMBUF4G5yk0OFK666Ef5Ogmq2a/Pdz8sExBjcg0BqhKEAaIgoTVIpt6DDsD9mY8H1Z2ajrun0CF+7VBPyGV0iPtTUu+XCSljzAqChoWHrGCQAj1FVJFA7c4whJgDnHqPBkEAQskAIYU8YRAaVaWdMpIGsxtJZjhRoSA6AAh8FICg0LBx4S84JAovAFTKK8Xc9CFRQ0iQlQ/Jwohgl4NI/toGEcKuUZ6C7HOf2FWVcsZXltcVWDOMEwJ0+0ndDLcml0rzbsLKQUK06IFzQZzFJ6jywpIskNJiAnVOkAeIBMfICU6usMkgAhAakkmAVMemiaJ46S0XetrI0BREmuqjELJ8UTjMW1i0zFFZ6zFRBOaNy5KRyihhkl1TlTJHKpqumzaOSrNIhncRrGFKTUSURRO3hJdst1GailuQzZrWZmHsSX1FFNLXNNMppNI5xuddDNZeT1IUgfSCahQ7qI0dnHV3f/70mSAg7ehfsfbT0vwag8IsBgjSFzx/R6MsTiBnzviFGKJaeONx5FdG2cWLchQfYj2hZmlLEscSVCU0eCoyqSOa7Mx0mnMSrJuSz2/ypdLX6Xl6TP///f29/Q+KX9R4fOaHt5fCXBJz9+5/Y3eoBNiaRMcPgPmRGiWR/xGq7LQhpSDUbJABcNmAoa/BoijEIAVEAIVaNwqFipxvAmGU4KaTqoxioChrzQWsyCWmt85T/vq7T3wxKYZl7KY9G4CgVj24o0aqQyrisknJ8NDCYqumAdRPg6y6qOWDITSsUgrwmpjhaYD3YtA6IA8VZMrCwuISXmjdLmkRtGQJTRFol4rSizZQhkUHlXExKKJwmK2o0QwVVRiAbNsJupXECB81p7bJd5u36T0tpxk0yVKFugSqJTEcWix09MqwZTpurRHVIo6evCjIjqNkxZaRhnGl52myKrg1Z+H1qJ6CzKyC8dcHYz9RwPEq1IFqMKT1G8titBj9VDr7D05kFQKz3fUKjGq5jGoYxIWhPBFmFqo7lJVCNiVVnqYdViUQ06rR/a1Zn/6VXQjfdqnqfoc2Fb605Cr3Yy0ZLaIgdqzu6O/oCIVue2jOqgjFYZKHBiJK1ugCky1Xkisgqo/A4clQNK4fwFNgfJ9eNtF6GA4bouIrUOhDCGMwFKmCu1q8KZNuVtxFh2vgH8zE4SScsQgQaE5Mhh8ySReLSu8iJysTz0GwhjwKC6Pg6nqklGA4twrSYdMqzU7MT/FJ1zCHDREmrS5tBtD97eMVpOgOAuJ6147O1hifwrW2bGaGZr6vTCtcVNYjxwx59esWUvHaI9acqhOP9Z4q4hLF1r9VOlVUoeKq9YtFmOr7a5+yVdAmP1s1Roy8Ure5Cz+vNmR5eNDv8HNQdTcjXuN7i2G17Y7HfKvLFv8srVJUIkDgASAAAUzBkquHI80lpy5Fw1hT0qnKbxE2jNDKKcmxvSmWcEPQTEzMc7CZtpLHF3GWNIdROY+1vnk39/jJ/97VslrNIs6foZ5J+gB70Nv/Xw71j0W87PukJ26+xpj46gSVFe2W/aRBcZYKAxiFIAkeGTjCqc2icmukQ5BUGFTRCDJikrRIIRJlCkJzhrw//vSZLmANzJ6yGM4YPJkphioDCM2XS33HW09M0m0OmHAkZT4ZaxVIZN1dykUjEEhrmkRvPpzTq9UJdmAsmtJtUeCfiFvGVEJ6CcqWOtXzOamUKWkfbouWRS6aXqgsqla9OE73BVQzA7qY09laL6DOiTShZ7jJZCKxkmkqmeSmaaL7NCQl7OHWeomlZGk2nKeupiJEjINPHvjkmmlDDGwJ7ORKEqk5uNG2V5qoFod0UCJpFISYmwws8o0h2Z5lUQoeSI0essoaZKSRw7sKTI3JyIWqQSRrJwLOTb6llzCN7RyR2SFljqoA8VQlTV2P/ti91ESKhBuGRDcyjpr+Y52sQaYDKP8aQaOF4UHjh1hQeKIqx1TqfsYwuooZEF/9/FX8c/iDmR48j/UyoxlZGceVEUrTKYVMeKm5hIgb/E1/Q0ZVRTFlFX6E/M2pVTdCRKWxXsqCRZqRBwHgjABpnOyGyHoWOlmMEJHmMkLWsJGjQSggJL4J9IRkRsebuysdZOSDnEJ6ZJNVekRznoQ9oWX48EUkj6Jibq2pD6Z4Z1FtUqealgm7pBqg7SsT7zy0fobKlDoNZ8fiQJAoco527XSJ01OSgJA7LTJSWdPiAIJAOZWH48wLqEsnDks9CqOtyiUBL9jTgTqPn9B3dUkBQVkZXhLB4akgqI2lUDydQXDMnEk8SRl2pbP1kS0nKUx4rKRZJx/GPx2VyAQgnKyNWhkhe7xokHTSKhjyQoFZKGtiMxSG6FGlXUD11OfLD2SYEiy7pJ6Mw8fSkDRw6hHddRahlOMkQkReiMWCO5ktqlqOHwAIEQAXAcHwAMcKiURXod9q65t3L/DDjf3tutK1rT/3sao/ZgyBKSiHzPxpxEl6YmW6siDDs5aT70WbdA+Zbtyz7chTZR5OiutBRd53oaiaOf09VUoIqqNPqMGxeql6EFRHqRkCMOA6Cj/ogmFlasz6hQdbR5WxMPib3hTNs7HeQhuedwetma0DuYMZUInMmJNYqSmMYZQoINgAzQjQUNUBpAsAUQp5KWDxTNFN04CQnOgDfXkfDJGoBekgAlydkJN9xL0ah3rtXltUJwwxJLi4PVESM0EWcp4luHfa5nJ+AoNMh//+9Bk+IOYZn9Foy9kYIXPyEggxdYhxfsXDL2Riii+YYBhmbmkxUZeHpYi9FzOZF36PkeBs6e0PIkMRigcmaksQHFXSAySkliCVVwlpDqr5JUmSJcnYIxUOWlSdYXboB0cFJo9M1J6XUA4XnLJIehYTnBojaHtGcaWSu+vGZH9ZCJQlGJ68dFTxzZL1zCCEP2B9jVHR1UpkN054/aLzJTaEkzeGolCewVysOj6wrGB43Emlb5ycuj62vLJjcnsIRMKhVQByVsVMEJoxVImTtCLx63cYmauJFkMmlxRUbP5iK3XwbigoI6F2pfTvd+MFCgiBWCFwUEEcqOa1AJCdvmM0zPnzrttKhXw+kEdZiseuxKNTQi13MSnufGiMZ5pWbeczea+LIMdrfLtHd0jiFpTrHPqPa3/wpJyXOZt3x39+GwtZjsUQYpbY+NGMmtVG6SX6DxEOxNFvaEPspk7njYbAAAyQ0iDGvABYKZA0oMFALsgRAEKT7l/S4plBBYkt4BjWrl8WQr1f1czNmtoZsgDgZY4acchhFUjBJy6Jgoy+RzjHgXQvIui4EUS7KcUYrFkmIpJOi+K9EGwHOcqVVaZHoenKUqGkqRy0biHNEuU6eRn6EOLps2VCky8dG5XWwxHJPXjycFV18fRMIy5sfa0IjNVg8nzrqU3Ho/Oam2j6UzkSV6h4xEqMnlMiKTex6dMEAiqVJ+fodGDhUQFM7GdQlsnMk9DLTZ0pLr6EVC5Yai27jpScbH43J3KxLV1gLS4+UkYsHg6IRtEnoOSc8LK8lJFj2nJXQblwzIC5fCdIjw7jHMzMqEM7bXRpo2WfnAgAA8E16rnGQLywzt4wpqa1BzDzt13FwXhZ2WtFsuFOHSPeUjEbTJArBve+DilsvrjhpeyOSrB0sxxCOMQ97FpD5jrn1VWPGpqg3RyVVRy+6xhJfu0ahqaA2WOJnA3kZVlhE6Ow25g+DzXiEJqOCcL3qsoveo6HAJEttbBFhpJKcLANqU4iznvO1MFaiNwROFkhqoGIGKEaFojRErC+oWBUxWiS5GAUCDp5oahJT+Okeo7glRBjD2pR2qpAG+DZGUwB1DWEJa1caSvWGM9kUcQsyIM//vSZPKDuIx+RcMvZUJ+b4h1DMPCYz35FJWXgAn+vGFWjFACUnJ6GkXlGKhtYGNTnCeicXZqsDpMF/Ty2ZZ+HxVNxF0b6HK5eovM8ZihkxZVMn0W3qhUMEY15VcnW9VndCVymohLI9rRjiJZGLKmvaKrm9MNiOIXVdoQ6irNUTEs3RIzW5KdRN6ib8J2zWj529WsD4/VA/tOr4kNlcjRioexwE0yq9vbFAplZFo3oyMvRGpNtLxHquidT6R7DCVMOKdLYc5vN7zLRB0oENbIK7YUYpGR5BVLAxP70YG6ObSVUL5DLsGH25glDQe4KZlyxHez7HMhsh3dRosIjmRWQxnlEjEB1KgkA4+Y4o4iJkGuKQBIcIhRjC0juwSUjYw6+cUiLosxaCrsTdzI+Vkhmz/9Sir7h0iYwe4kP/uZmQPWZlDZSG41foji+iHzixA+6gxQgNdAWpS9EZpB74Yg4e7oVExxg7mx9QKQIEAAAADLIsMCC4y4fjLIPOGBA2IhDDA/MZA4zMRzCAJFp6YqFhhUmmQwmPOQx0BzHhBMIEE5AwxRUrACRQQqgjYZcSDjphjgyQMsVVQDg5GDNSTMsTKD4BQhABPVyEKgAGBC9hBgTQgAiSMBDQMXHiRKJXMnWZwsgJEi5kBJiRAlACMBlWIQZMGgRaCgxBGsoiBAo0nGj2lks4Shm3xg60dBEdI0ZNaXZXOUDUiCqBa7D1ovMDghc9KAtAW6NOxOqzCMxliCs7JyZIiHJVyl5hYAl69LZFRO2AABdxYMmDsJIh6MIhBq2KCGEBGIFF112ojtBVWfhkqc7Skb25TqZMynQiHEmvrnSBRUjCCFFNfyqzgiIYqq1svgWtLto5FynaftcsJRxXKxBdi4adt31QbXoxB7FB1qp3qilTIEzV7NZawm8iq0gKglaGDpiragZGlCc+KNiA5s73MQUJhhWdWwkFoCU12WKGK8W+kEoqiyrO8TTGkKkgsgE////////kQ9PB5mtr3T4TWZBgocWbWOmIwxQZrn///////7WIipwsGmkmk2F7XAxL6tSVGwwcBJYAAAAAAEFAGtcibEDP/Ekb1m3xqS6oQVlaWBGH47TbiPm4uMprL/+9Jk7YANr4pDNnNAAKJxSGTEoAA10ikZeb2AAXaaJBMGUAAeCeBgNE5fHIUl0rAvQkOA9iJiU7m5MhR7iCHaLFww2hlxZRZt3A3nIszRDe4VtK5enhaKiy/ihiMg0dA930qsaS05gvvBLauqwR6nT3aog+R7o0GnjCKHqQLIyyj3Clf///xbi7FUMlxCMZx6f///jxUsWKGDXBoYwqWhA6AAAgABAAAACA4aEOxYzCLU0Q+KsKfGVmXqpvTWZeYFyTJYw3lWODwTWRs2sDIsUNDzGQ0DI5jiaIiwCAIGPTIRAws8NnLzDD0xIIMMADAlcIWDDQAWGTXUUw4XMVGAABmaJYccGDjZgxSYaJFrTLTcwMrMeJwiLMLOzP3sDHgcJmYhJhg6Fy8wodMdAQMpmNkpgwsFQ0eqjCCUwNkOtyQqdiTCXNMNITBjow0bIg0DBJmBQZOMA44LmBAOIw0wVEKBIx8QM5PwqFmCgS2SsLWZABgzaIyYRAZbdW8tQFwUgEx4RMJCCIUMZC0cgsBiAVXcTAamwOAi0IUAEcFgS6ifAiBGiKkGgBLgWK0Jw0AllkYnqTtfdgzmpgs1SFSUf1pEsdlpM3DlZe8RprNMxielEsazIXveBy3qm2v3ZC/kpceWNZdmtAcASPsZnn5eWIW7V165986TB9oXMU8ZoocjcA4w7RPpUiz+Uk3KH5pIFcnGmi0Nu3NzL/YzUrmn1e7///////95JmVyyW1K8/GIlXh+zLZjL///////9wM+xiifuzFJY6kSkUAxOZhxAABgAAAAAcWHxYtxobNvob1Rp730r28+mcTaNKii9EUXUPkDpEEsYo4ooRkU45CcRcInVkUriRXJHDRl6D5vIrOWf9vd/nv/+JkMDA80s3+HkiYJKGrV+lSAzMgF6pJHnMyAAi5KI6zMZTDMpg16TebNg03HwBCHRG2gNRDzL+hcABFF8hCELkLcCMiKr5DMhluR8qljJ6cqpJPQ0lPBSKtValcEmcK6PJ4vnaoTxaHBrbVGrHsVSyq99syjoLETJjblAcx7HM2t5vqdEtsJzXU7e/uiY8l8K1QxG9IvmxXo98/Ri+iUNYobtcLUZdtjdFZY6v/70mRLADdhaUtvZeAAay4ogOScAB0F6SWMsNfJm79i4FMLiAWE0eTe9VkR44YUsBxZHbFCmiQ5nkJY2w7xI6rMxXfbcJWXECNEhuqoe81O+fzyxZH7iwuTx/pnb3FmiLvDmzRVXqJdsY2dUwbuDthXofX35OoOU6FUE6cj5KbGwJZl/aqKV4h6qOjWJLdTQGAkd1G5PQFABh4z5j/lQDlmGAPIlQsKBuLhNKjAkEx0mTQyo+euiIjvU/zSBJf6iSVOqMKeN28wxv+pzE9PQkPt/9G0Mv/U7//+eu3/0MQQAGHvy4HRTtrbQATSfhRxplQo1GwukMYoQjABRsCrxgIwBgbGTCgkQQGiwiXTTHKLfMKhxkUhVXqN6+sgjcA4T7WGDRoFj5orLgwA8OxwDbC1UKdJq4cg1IgKCWhjrYeDxYyXAPIySXBLD8BtVvCSeuKFpyNANhCDUmF9DLoiuKFq8sDlGiIDC1OXVJYTNGRmmLak9LqRU1c/hXLLnXcwcr+VKD16FiSCkdXOL4VVYYH5aPkSO7CxqXqvrqJS+tfbSgg89RyR8EXEYg+omlE5LUlG2TUgwGYtTN8bxkPLX+ZO9C7mW+da4v4W1WcTQAIEiIOLAr2zutSiIqk7+8mNQSMRuKD+JB0gv8SfqeqoQQF/8wGIdLU0QUv4eSvHZO+Xs/HMqb5nK/9DkbBHI3RjNX4/KSSrkZjGdiWI+aR0yuuWjdWJqT/9BnoJ/p0LMX//qEJ/HWpO6zNoqSAAIJmIihGQwbw1R8HIDLLgWMJTRpCIKOA6WYZMY4a0sOUCgJChwZZkicj5LEQltJQ9KF6WRdDpRbgJ4ZJuEKTEQwWk40bO5Rrw4srIuqnikzWMWZ240RzKU0QBgi5VAzMwIQC4DopQCFQdZSAlDQqZJgq9UyvIqvMsusdBtEkeaTkytMkLs0RyWPw184NMmG9fiSGmrJ0pFo0gKReVg5OMdkxB0G0RmlorNEXR6wwNnKims18UROTudqGUlhuA8moK81Mgpl1zorRAFLfyX+tMVJlhXVqjE9PzMtMYw+CmQ1WI0CAACgYwQqUKvo0pys5uhAgZyS6BjI7OHz0I2dFWZltoPqgcxGRg//vSZIeAN0R+R+NPS3JxTxilCCMcHZ35IZWXgAmKvCKihiABmMOpTNWaG9BZ9ol3DwcnCKCXlKo/wjewuU9CstMqn7AuI/D13HjeBd/nPUGG4a/6PPdZFpFHXwVwaxTSiXLI5ufm2hN+ZJjE0P4xy3SRorKIB0miBoEwHC0FWDWANlgFamgOZpIFBRyT3WSGCIBF6rAIgw0oLgYSfcoqEn2Qpva4zKWW2Z4yKJUn25KWdsNl2hhfzGhua7ouKbP2RaVLxSNbOqHbMlo86cbY8OMzxqOVX/hOFnBsnZm2m4Er+FOqW5WO48Rlo3TK5hb2FreOLdPDY4cDEGBM5PX2tXzeyrpmtaXziLuPK/jP4+3sLcLOobdGgw7ZrJaB4ryPesalMy5iY3abTY5wfM9tAiVrPWWBbv3KDCgT5nhZa6Zc8eJVji0xCqyxrSrjEPN6zxqQITrOm3GNNkqwDQGCyalwpYZ/yJeyVKpeVoZzmYzORnRL2Z03wUjczjrR6pO6meo0jo2rkMwlnoxHYxkKQ6FM7t8ABlZ6oxeqW3a4J0d7aGETdfqP0XOf6J/wpfqLP9thbeQf0L+gzDE63/DqgDALFIADIQDIUDYJAAMTUG0wTQIjBlAOAQKhh6iUmB8egYKAFACAzMDkBkFA6ml0WgcwjlCiA8AWYQYJ5WDSaFQJBjqibgYbSEBxYOCwAZ7ApRtfStthyCQrAtLgBAIcLmee70ia0jaQAKYJAEyCdKABBoDmCYMkQJmJgIGeo/G2jTGcgVAAAhgAV4sxZAYEAYjQkGWgAQAH9kZGleJneK4nKcfnCbQgQAhoEE6S6JfVcwOCQwRAdNVgYEAIWAA0BFU55ic2fPUwvAA3NU8yrBVYWPopvFOtszWWpNppiwnEgDIaMPMKgaNAzLMgQtMEgQMxx3BwVGCwBKVJ6pwNIT2XK1hOlpwUANiC7o8yh3IJYYzEybIUxfAUwiBIyJGUIFowaAwxpFEeEMICSIQbAbZXkhqnb6NQ26Kn7LlvBAL6v+yao87qGNYlgUFjCwDDCcGQUAxgsAhg2CYkAaYhiCE6P0PWnVlUDvA/0DQ9MSaAIDlEBvxA8BxGAYnDb/15FNVJmbr/+9JkwoAPe4pG7nugAJ6RSVrHtAAvFeFA+c2AAbuqKV8MUABwUABhqC5CBwGDQIA8GAQEAIhkYKAgDgIMEAAe1p4kCANAeBM52JwVHpmQSi46M/I4Ygqc////////lktsx6XdhvUzD0byp5yJyL///////8u+4xgIACggwBAQCkCBgGJlrOfqMOzHAMBGAEHgxowgZISDIKAXxjTalqfcRUEk1uHiJPqYLiAi+59ZSAaZD9NJnEYHOMGOD5gdj0JQ8E3BIxkjDpK7toKYeYcw1EzG0TP/ao3y4NZDEsHmPdP/smb2WnZjRIly4xcYv//bamymVKCZ8kzhcN0nQHp//9X/6BIGZgPhQTKBgMAfN3GENK7////1t6f//+gXQtZTOFZeErHwgIuo6I2kABwAAAQGC244ZFRpiGQGRombGKJgIWIuGQL2Y4LJtASmkBWYhHzFTYh1MLAwwIFyESLvU1Mqfwh0FCAOH01U+zbWYAmBp5MYkFAIxAx2FgsGgyGzFzCUgxMpB2aELBITBg0PDAwLmLlQGCqQ0qJNGIxSKBTSJKRoC6ZO5FhnMFQwxxetu6dzADBAkx82QGmLlQXFAUVGBghgiIZQiArKAR0Y4CGCgpbARCxhYIMAYCHgcBIhCQWARxVQdCljKyMiGQcxMKCwqlSWtRObYQAa9YxMS6LKgAIwY6AgwABQsDht1yIiEhcChyE8uhB0DxGSMtrPjDUu6vGi1DUXLrAIKbKnoSgCmaOS8E40OzJmWIHLHbioQg8o49ytigsedbOSP66UXw92u0rrJ3A4CWBQ8Ys4qPTN0LVcxNqCDqtitbKnFgiKvEr+Gm5uI5L7SJlUhllfGNV7F6lq13Gzm+y3K9f+5IqWzu9//qz////////+vpe67nf//tAAIAAAABBLllFnGjXRLlHI7+p7DZlmdMylndCFUWRIweQOqDsjM54dc14m7MhimExBhqqNFyzvYmwmtRS4qWVXUj28016oW8rO2jJ/d60qQxlZ6JVJRMg91Kg9koE45R46I5t7uDUJE3Q6Rz389RUktKpIlpABAABotq2W0BEAgeYIECEwcOMiiMOOCh0zA8XQmZtSwxxUGhTEs0IIff/70mQXgAibZtDuawAAdurZzcKgACFRoyz9rAABLCNmt4ZQAFRFlGFxe0hrG5xh5a8RtLPGlgLanCnhRQMRFaA10EjFloqCGblw6o0z4HSVWUk0FiwjijkcABvAutuoKCh0VQQHNZWkwOZV5IjA46mE4H1I3lmydTK12JluBbWtQPAyp8px7AdgvUtEzjdVrSrYHkbhPXLYTKoTIXafuOxWNz0QaamOqRRxyVRsfZxD+EfsVHKle7luck0O4TMPzucnuZNZaQqi+LjMQasyN8IW8ssq0uOEkprVfLO9jSWqXOe+e7K8au7kSd5+X/nYbfyXYSyQTN2MyjHd7fcLt2luXLVm3e5//WAQBAICwAAAAAQGBAaQiit4echwgRFPzgBpoY4qFxsQbE83YcmFCwdtWYHxRpQq0mjJbmbCESDhKecGiNiTRZVc8YcSa273dyMdEg+l6OPkdNuOSZhFho+F4n6s5pqOZiPX/2+tv/+B+i1Vy9DXJGHvRV/iD/+IURAAAAqDDoyrglKAIiCHBq0gjKmIvHVLDgsCnBERL8gEAlSxEIYqBOJMNZSGYqvFI6CkJLcmFOUWwhbuKufFRZTVoKTyEbglzxZLMllt4p0jCAEkCRYKJyyhYyGQRNTyFKBEKPMQS3iHqMynI8EqCQqfUaCkMjGX6b9bcPMTZ66DmrKsOky5mK7FM2OqzEI1hqFwW8b/VBBm3xpKdyrrtPLDDrahqq9dR1rrWY5B1eK0Xbcu1J4zagezPztWNRa1jawtYzM9uXfM2ZHhO6jVPhhW7B127UrZUuPaGkt5SeGrVTCCIxFopHovKZDYma87empbYtS6Pw5I8b1JAdikxfmknbEogg7/9HW8IgK0kNgAH+xghRuRVq3rJu+nxyzu9GV9zfI7/K/8ZYpccxBI6WM7q6O+Vr0X3MzO/Ml1ZgYAjCoEMZdRd60fcfQ+K7Lg9/K4z9m1gAAANGOzZlC2Y67nx85uISFyw0dBOGnD/MA5EtMmHTWFAw4EJTsEipgo8ELhigECgIxgmRWBwUmuXKL2K2AoCaaoo2ZZqmIXBwQBkQhMLxQDowFYKgugFa6UBzGlVYFcRB5HJBGjhA1EtoDBLQH3//vSZDeGiPx5SLNvP1JYZPkyGGZaIz3zHi7hkcmntGaoVI+YEYItIwoHaIHBydyumBLREhFCaBsAKp6LYNYbInpSmgyhHjtARQaKaOlllQkTE1XSPYT3Vbo50QPkyUcyLTKn3NsROrle9PZueJ5dw0MVSdN2Cyop4ooyec2VuUrOmJ1bdVWhTtbs8layRG52c7Kn0YwQVd2eFGX4q0r29piOba0uakrRvVMSaO9TTdd0zt1pojEztxnqlhdxmp/d++iS4mj0QPb/+pe+LfKoJMV5xK2gAAcDyQcm+wQFShxFMfR3OFmurtvCXDXWqtWkq607aZzW5SQLFThW0kaxU6Ru0Oos9gmLGyw08RwMk2UGGRFUrMfq0wj/iZQtpldRV6Nuol/LGb60ockqKBMCBUBpmmPBTmZx9HVMIGLtXnURzmIiSmZB4mRIdmgiFmLAvGVI5GAoQhwWAoEjAQJRYQQAEY8AIoCBdtbZelCYzhVJlMsL7CRnhj4sFwgcpApY5cmWCMDHm0XioeismC/w8pOhhzOkSlRv8mzCFzwKzVTBGtTJOpTZjiuWEWkimCw6288ok0ORF+S3rfRx4H7etkqQpd2yzpg8VbSOstoaWMTKUDhPMzQyXhw7Za0WSkXXqIJpuvJWO+x6ZLVi9czzKJfLkbrqA17p6hR1jXLVpw8ribailbREjbYq+zcknKVCLSVacUSHqcqOSuB6jihdAWkqdlDXPrC0XB7kuqWi3TPWb80WObM3vNOlw/fmcp2zOWz6dNNfrH8kimWadhgGEQQ5XlTydpUbf9tu6Wo697f/tO5lAWHQuDgoBcAAOj04ZP3uQ2r//t8GLrJ5d/ZMSZbq1It27KU7bBRgQOm+vC5wyd7+Xw6UTrmlQnneZIxOZoQQbP6WTyysaTIDscdA50oACAABAFOYLCmESJriUaWYjjCboXmrkBqMyZgQmaBwyZCEDMADTJhRKwiK1yJBO0BghglIxBAOpmyJlBddG1vkRSVDFUvwugka6JZ1rDD3gEjCJoR2PpZIDVLAcNX7UURUaGjGAL/32hwGoozJIVyWmqibsgNJAl61nM4VUgd30w0qXITjGhoUylZpZdWldK9Fhl3/+9JkSYIJDH5Gw3hkcGrtGa0VI/IjxfsXDeGRybMz5vRwmX0QmNLCyB+IvB8vnR2BrVqhiPSGWkxeOkdCqTxYtXPlWhRbLV70LcKjzQ6U3Q0xnR55Uy6oZgwmNOrYLNrf1M1CvjrW18+PlTi+RHhUrly0k0QThDTWLBbRmJNMWj18S/Xie6U45KZOOB8HdOy0lPTRQ20hxExZqaIvFRbRldSN2kS9gnlldFFhvjZpdenokBEqxxUthSS1Vi2nlqxS69c9vMb6/6V00r60/nUc0eDDzoTmrMPAIuiUtZWdq4ZVvG22V0j9KKrHYrO/mo5wpqFEE7h9Te6juxrVpXYFJuJFQfqs5lY+DA7UJwcEozNWoohweVYkQ1SuRMBBACgAwXKNdJjCQ8NBCUEMXNDNDE0kwMQMhY9KpOX1GAIWCiYlIg8wAAMKDUulS8fFMFqqvVVgqRKFBVjjMUk24sCWUy8VGFgpdINN3V2vdWGNNAedopd5VZJJUyEoCoiUAshlr0S5W6TMaidsuqyGCENV6SJQZH1yYi9beryQlMGmqiWzju5IGepessX2yJgTUlO5qWXl1FMvHyNAEnV0JFhRodjorFWSq2fHY+Kql1w9Pz2kfVaw+2ihh1LyZwvrRBRUshMcdraIB4WoFNIC6vO8LiZemY8VXO7QOxtD0dQrFsTip1o1MUNMSaOk9apWQVX+nPiomPd6qguafrm0SEZkl0pFa4+iUwvcgLo45CgrvTLDyzpdYTFVCKaNXKmAXAJvklFgIB8rKY6V+5t3/79f1ZGUyRFp+ldCaN1v/vvEX7lDjnIomjZBl5Hq49UWjEoz4ZCWWx8y021a1ynL5h507r5O1ZHDK2deqbW8az/O2YzbGzkzdLxLpbXObLq3fZSNOl0Usbb1QmoBCUAAEvJpChj0puUYFDCcMDIw6cZA4aEq2gKmFQGZMKARQwQLwEQOXpJlslgdl8KEkQgLCEOMkOEpQHA+TjO0LsNMtghyGnyW4eRgH8hyGkFJ4nJFthbCGqw5TqRxVOxNiXjgdMhQLoepcmWe5vsyGRIayxqgQiELpkJ0QGQWnMcQgqjWmRtIiUsQMksRkuE21lBdHAK8eGEZdP/70mRNgwgDfUXDT0xidA0Znwkm8SHF+RcNPTkBlrRj4CCNuU2KGWcViNiR7YhIFkUGWYzUQnMMOGisU25wJEiY6aSO0hGVHEE0E3CsyyjmePhc/I2KQeTgfQzNrDrKbjY2ZJly9GCNCq2bILREApM282T00Xhi6xp5hleaUbPRniUFB3GkSDVxxmSIjLDq3A4kXMw9yohpJ6as/N7U338pmQyyMZP/8vLEmRShAZ0HFIfcSCofEjrkyebWchyRxJeWhbV7Yc3yii/klwbZdFOohrC/b40HP5+b78RfbGpbe6ZvmqbRW1S73pOloElbSXOHU+ctiyTZmMXv5v1gCQYeuaZJoUz0MzSrgNjAWJYhFBQyC48rEGPFEwMxQEWBNwJgjYGxtuPEgaFVidVCCDnmwnHaaY0Btl3rFd5/WYPRFn6ct/W1OJvYm4cR4nyPg13A8EmZJ4HG6jbP6Anlg40CfjkX1EVMkmKGq5YXlYWFRocfpcmxCLLzYr1awvGdVvsK12XxXJkkCKV6w8jMMZLPGFQSzNDAYF+FCMAw/sxJEJHhRB5gYImbIRGSAZRqroUbzB4Kk8iCkZZUooQeaERQPniMhHSBUNxD6wUGGhkSG6CiSiMFBolETIpZVBUvbJED65IHDKipxHYlYZmGC5GyXRisnKDgwH5IVSZx00oAgIOHAuTlEuvhlmKgBIZAIWcdh1JbTLqvM2E1RGfXP7z/fy/+QUskUEKoNVndeqSChDODUEzpzUv+M3w+1fZUNRKrS1/UihnmzOOjT+su8YVr6t/lexvh8NuH0qUNvUTRM35HBUz33dCGwuDXLojgroNVASThbMAGsmEisH6gonBJgFWgEKMsCKABe01QsIFhzUECzBgZ9bCVSN1ZurEF6MAWq7K44bch4q6X7qyBfqlc8fAdJgGjtIEpOHoXA3OWz0oLxyMh0JCUQj4eiA+f0qOpDFx6SWViI0Kx6pL5sVoTp09KjLaqEqNFhTAQj4+K5LcDxtsmHKdUUzuxjy1OcmqzVULDSEoYUg6bLBooPBuJEXJ2hVIhjjLaHCEhNHcRqtLsE6NJglcsfk1OZLJoyKiaa62I1lCNrkiAysu5VYRHz6qQ//vSZGkBd71+RttMTdJr7fiVMCMuXXH5HSy9MYnCPiJAkI0RowsjG3l1rSkRSISLmaN7qx5qJQEOdlqZmDcs5qSphyGAjlPTW1ggABZUXV20kbvGIdFCBBvYNCT95/5I7ma6EjlXme0XSeJ8jhQMUsH3ZIK1JUPh06IVz+TRvb4R/l5mVDe1yLmb6Fc1lXqrnXpPleMdRio+kty7rmZ0lzl7ZbMeNVUzh8FvyQyxhUAaipzIvlOX1kQoFONA7yiJgDQnWuGspgmiiCQRqkSmApyLJgiroEQLEk10nnTmFAqiVjOGOU6gLQyisT5kmqeznCQuPHYz3UadVj/J/3eFEdb83kBCfMz1gTSSdKXUwup+F3VMj47i/o1QJ1PLBzmsUGmCdgVM0pJc4cVYIjYwlpA6BGuKMJxE0rsUZpNTSUthleEbRKQXVOlSN6aJaCbViBtKZpHbelWYVQ81FolguaY6xISmINm3sG8SLOQFG3Mksi9vNJkiZOUybaiBGxGRZJLWMkfIyHV0Jpl0rmoTP7h1hE4iJJuYuDMYyejQEqEKWHqZZI0NI5lLrDslcH4SpS6iUmPpq4N1TdcN/BTGyl+kF5zUjpw9RWqHmkzOjhUDOSebJCTeyLaTUjJx9vnYVMl+qg/WwZ+PBtQ2R+dwZBC8oOI4RFnG++TpTbzHFS3mCRCzT3xCf+xllxy//Tg1PUUoqxwkYQKymggUnCrhFMWvOtqBxV0EjAcNEEGCkg7yJpmGCqm8DiXA/SeD7neraZRdkir2BMnan1yLUhhfkEb6DLaocJhqnX0JNLCqTzPl+akRTLMBn2pXxINmzJoiECMdHLHQ8iJE1UnSGHh4gmFA8gHyAgFSOag0oRiElCIGaaaLipZtxsTKyokDzKY/ILNJsIbw4xpTYiiUF4FmEzJGzCLlCyNEbTcjixNZNzyS5WRa3hK8qRqkaEgQxaZRbizDNsCNKaKBySdELbYg6BrsMpSLsidtISzXkxLWl3oSKbCamLppRW8nsI2hYeMAMDVCjGzMM3PD2c57rP+VE13/H5DI2erzBdlIkJE2LI0CFIamfPIt7pYn55aH+ncGfCcf3ruR5ZlWkMiQn7MDvc4XwzD/+9JkmQAXW35HWy9L4mQOKLUEI25cWf0dbLE1AbUu46AwjfGFD/LeQs/iXNjoUd/mVdqpCmg1okMVBxBVPGzw8SE6Y20SAMuRHYS6YFSjBphomBQjwuQUIGRxowSbWariHCYVbzKGVSBrLlwYv12IKlSxtIB0cBUqEUDWsk0KCFG+kEQPdLJgSBqDlOgnEk9xYrYHZEyZlNCZENGnKKWNEchxAfEZgDyF6M6IkbckQWJ2lGVyfdZZNFSxWKEhTcwVuiUgNIkXNzmmk5BKSG5txGm+upfYZkhRpyfJM4Y6bKJDsoTKGmkkMtK0xFltnWo6TSeuauCKTDQ8ukurdNFBs5rKp5NAom9Z+4sVOqPaNpoJKaWbRUojKouST7UdWrUUVjKWBUOoQCALWpIif9jWUs8Ev1tywcpfnBIi/LSUEICjiA54YbMEWUxb5ORPwTCrkYvfz0an8Qsk+SBEsNrZQRoET6Lh2swiKN6Gs1HDkgA70jabhgAQRAIdx4GuHCHeAlnJL9ZTx7bWwYAJAO3UQAp2WS6ISgEoPgmgYyhyDmkR1BuguwT4GfMAnQG5CTlvrYCCpHpeJyEoVM4ynRpg8rdNf7sRR5n0jK53GgUM04GAwCctiYFFwYLyuO6KBknpapFOsCgIDwwH0J15vAEgkMhwRCmS1RwWEMnrS2+w6ZplHQKLzGxC65ihtWVkhhVes6O8uMXjYxSrRLkraxll8499e1KpIysWZX8BhmEAjaHHfKK4KHcYwMpgAkQbnUFmEP50GHEBAg8MXCKgxTiLxaTny1KZNUe8SxUqPeXIhZCPBQyTJEhKKKmQRapkrizmdai0sWbyXGPayqf88ll67Y1jCc2TGToOZJEemjJ6JjoELci2s0EEeTuUnrx3iCY9pC7YqvuvpDH20USe8q8rceFl7JbI497FWDtO4BHeinf6iRjTVsU94dDYWdl2yzXkfc5x/R++VvunaivFsn35m/1DptcPDq7YiTUbTmRTqVRT+NwyqYgsAUZoBpgA4XKBUERFzajAgGaQuKljVqxY2YMGXjDg7AGwO6qBK4QhhUFDEwyguuYFhtgBDJfgRkEzilgiCWiwcGnR0u6iI3YSKQRjoP/70GTZAAaIe0jjDB3ih+9pHAwmfGKp8yWVrIAKGr7kYoKAAUrTgZw8C0k6VzrQXJSxBOdXbcku4qjyxVyU2HPbEs6y+LBXWZqtxuCszpLzVhTIUVaOx5t4Jexd2DssmlcCy19HQgyBaWXU8ZjELh69DMhiczFLkqpr0mjFDZpq1NzlbKkv5bs4a3Xzr09Pbr/U1rf83b7ZuZ2KPPdW7jc5vD8/r1s69+7f33L+391Oau2s88MMe1e2vxr9wu5du3b+8918v1/NXNUmeGXKu8t93nrLWHd6qfrPO5Y3hV4FAjYAAho5gdTkHlX8S9cx/9fxM8f//zHf8XzHFTAyxongbBAnLGDQGCUBUPQ6F2EglD8jOFEaZMPGnOEghiEfNDLZzpmLFxVxwfWHsncmDrciSxZ9A+iVmmf4m2a5jmq6X1lV5pbtYX9TYvg6ZN5rq4lTfvvJr+OO2KtuGv+Y/JqG6qJi+c5uQIAAAAMlHzU0I0MaP9czT3Q2mrPWCDBDMzJbOXLDoBQGZRNPGqM5nqOa+TGllQznCiwWYNGJDCjkxovMmNTXlkyYgIxtW8w4aMLAjeDk3wcOXowNaAJbMhCwYTBDSEiRkwUDAc0bONuLBEzkzE2xlSWacSmTpwKnmWL3MtGTCRoxoKEo418uNELDKCUzMqM/MgEgkwgKjQ0AgUQGhkwQDQBCwIVBgxQKNabDSqYx2xMpVjaYAzqlHE4IJVaGlr1Ji8wwCMQAzVRkxEKSVDARdxbU2tcONdjTEMabjTVI4woNFLRoCJhJJhGqAadGZQB+12pQM4UxSWCwsXyT4boHJ5rSYZ23mJMJkRwBTkxY1EQsX1bx8wMHsCdFK6fUpVmfyMIioOFoGiNqpJ7Gug4AUIgYQjJewwMFAQCYOBCxKRDosFIDCIJRWfJYKNK7aRK1gVTP7KV7NNgdISUswkbftu8L1rKTrZw9UodhezKEwEmAMINCZyXxTCQYVQa2logjk2nRl0PPJAqwzOnuZS5TXWaLZkTU5W0Bnv///////8NuS1SLzaKqU7c15suiU8y55GsrX////////LuNFXW5EIYau+FKUNGUZct0XFZhDwEACAAB5JKyQOp5own/+9Jk7gAOeYpELm9gAL2RKNLDPABdEaUtnZeACdU3oyOQgAFb/ar4gZrWuYftus24u8+/16RM3zN/n+8aJm2s2iMpzposiTMM1LMkF8yNrLGYDAJbOjESnWeCjp4EZl7xDlC/Z3mE7OubaVp0JZNXvB3Z3Ji8TURnhvoMGE9yurxHtIDFWvk3llkkpJqs8O+t6+M49JPBr75/8kev/rPn73bG/jOrxfnGPv2zrfzb97/8X3XdoWIP/////9N21//mPFvmbcf/////+PPf3+IkS8D5mE1fSVMgAAbBJgFpTeCuxnpnjqd4BoyGaiCSAUcSCmYGlYa5EENjCwIKw6QNQIedBfxxKxSTGkcCIUBtp50yEgPiMYZdF2uGFsPM5D5ONVtqpSeTmSyJQ9WGEb0g+i4IXInVUyJ5YT6dPh+pyeHe2xTljwDhdp5v01xGI4WN41J5bexE6w2ZU9FQqIzRLuMFdYpCjb0xTTTRom48HN8VfWnT0Fzp2SNM8Wbs7lDj5w3Sxd1u9u+xBgRsVlrmPrUkCFDmVzewqyJB1WFh+zuF4WX9bfNbyV1BcJGCfTdGq3J2ude6SZO6lz91AgkAADCrBgpx6XHNf9f/xCJNIkWxidIYkfN1vsssyzUM3s5ducoqPkF4lOYXUQS2HRjxYXVB9D1mTSZ5scbQ90o0aVJsJFWsf/cJPzT8f3TR/x/elfbescX//ER8+3//////z00mPHHEU3GRR/Xutwc3RM9XlU3tdEiAAVl+TZZFBycw4wTEUGTTqGSgCHgxQlUa9DhMuFA5G6B7GugkaWxDjRLsSZEKWOrpSEq9gQtDyarpVHLEO5JnQiDXO8zXFLvFk6VeqaMrYXRVk5YnkBfWGtVGU2rk1SQbNpeWFKgD+NoycCz58nGgTYgZzCMhLP7GQSBIhDEeSpYXQGvBzSQ+SyaQ2uqyyQOIUzU4JWuouYKI0cJwQoFH7j+j2isZOlKcYvZSSFSjDKe6iSZcVbbb2KaUkR4jEkSNRup2ZIIrJf599Zvp6ZSkGN/sfX8MwbUnAAIAgJJnhgMQ+Wtktf5//2hBUNnnphKQ09PCwj/NvVvqbq9ROBTHSqzwnA4NHP4mCeDo8f/70mSIgJbobsrjL0vyba74qBjluhwV6ymMsNkJkLwiyDQKetGUF6jhJz3KNKiYRswSR8HVVqwn/4mKD6TvV3ZhQdO3/nb/G/GURzjJFP0W3/I3L/U7/0ChH/+oJIu6W+JAESqOIE8Gj8VMkce6A4wNQMlA0jEJoXTQAmWwqkqSyj8WSZS6ityZzApHAFyNx2UUk26TqvTCHdl7Du1KsBMmh9xjJOPgijsL6ilDHJUWaFMOkEgCUiK5YaEkcxBWpwSLwNU6olYR8PSaWT1bCJJuIpS1UWiMfSv46HdaAkEH4DhKfFu61kdPiQ4FzUKTgJLdCAcGHOwTjgHj3cKEGmGJdFJecDAy+EsDFT0ii0k7IukJXaJ2M6aCLEVpspTMWu0aAyTCbs28NFyvvu5Tf9UQ5f/22v9Kq//1iEh8ggIDAJw4xOefX/+NJcs+8RnLtx/lHX//+8fNkGdBIx+q/JH0tN/yWPbe0H40QGvJuqeQ594drohIT/3znXqqpR2obYjMrTuq2b/1+eb2hwfR+Rvdtv1DnCvoAE0GN0CEwvrEy8QKTWsjRIADUShnCIZ8azDEKlhOMAAAAegnNZISdXcbiwJhAyxiBu6VQ4RxCgPtFk2LYfZ5ASgJtDj/PwTdXMI71EoOr9JldKciCRuS02LlDD5UzYbo/jhPNQSqxjb7JSZWTwHbA5XmZ4T9nY3a7gsDYttybbsQc1hz2vbUWPE0wK9zgXdtkd9Fe3+5aPY00+tvID+aXxmxzYZYz9sgWWHbZI/ZoNcQaPK0iw4E8SuNyTOWsab4WHs94EGEw2ZoE8z/3pBiO6w9RXKLDh4j4X104zwYsn3W8DFrVtq0H4ve2fiuaUpekukyu76HAECAAIKDuiZEQQbw4Z/qZEAjjQ41RQ5ip41/br4GYVcWRxI99BHH/yDh+EB5jYm29Q6bqLX8VQ6Dv5H+ogL/+h/K/L/8j/+qIno/dv/+iO6DUdyMYNkVUjhFQ8QWY5FZzMgo9Ro5QAwAyAgBgCADgYDAcDARgiBMwvCEwXB8wwKox9L8x5m4RgUYFAcZkCUa5IUY35OY8KKYHAAuEyIKUztIM3iXEwdWgMFJeZyqmih5jkCZXzIS//vSZNCAB1F3yuVl4AJlr1jGoZQAdS4pNfndgAMGO+V3HtAAAcZK/MABjFwg0RGPbuTt9IROYgETFAQSNRYBBSIbUsGdCzemyTYOcDUG02AnU0VsUsTV81A6BxYzsxYCbKFEUyw3MiAzHTkxoSWQ9bGEbndQgfMykXRGCAQz8xDDMYKAKHGjqgoQGcGxp6tL4YUUo2/awrxBw09FMzEUvDPzEycZEgs1MiCA0x2WB4u2pg5oZqrQA3dhTD052dN5DDcDNxtY0CAIEQUigAAjBgoWABGpGcipaEaLwcOgQVBwEpIxw3fGHKbOGYDlMPx6ZpDFgxCB32gKZs3a+w9p8hYffMWI0JAICQwILJQOhqh8W5XrTzH3abPGVVb9Wre5kl2poyNv0RGZtPjKmbT3kZWwdkjxs+WFYa/ilLTWyMBk0NOS4sANZfnv/////+///////////+nsU/9qWJZj2N3/1U5////////EGcxyTw1TwzK4diU7GqeeopegCAEAAwIBwMggCAAABjvzkE3BResE8B4kbY46caYUexWUhJw31DkQWN4ng8QOwJdSmWJQMQgJgUcTEAK88UCGSgdAnA2TcbEQeR2iXg6xzTgswsx7mRoTxxD4MGUxxiWiSDeC2Ba3UnrQYYc2Y0LiA8gihkFrA8B4BU3RTX1FwmEgfcwNGUUQWxELwHEPNhzoDD//NGTQaszN8ehImg8C4mVsYF937/b6HTp6m610DM65jrPUP9/t///UXHVv/4hdXStnGQQAAAXOsQ2lTgdImTnMN0oUlDjBr5Cg1SBEK5YFQM0BkxcFJET1Up4L5TAwRkikWQwmBMAqTFMkfxxiHhajKEBJSqiMHqICOQK0W07C3nkF63jxADxSCbDGNYq0XHDlOQbJokUHETY0TdExJafo9KdL69M1ea1Gp5solXOVz1L6mVSrUqyRk9FUywN1YQ1WRmaExQJ25mdrL5VtrErixLs6YE7kX1XRm1liKVshQZYmFNBVM0WzaoYieYtQXrU9e0kZs5rTT2JmS1a1RLLAnfO4rC1KlljKqVOsuGKJBZbPrzS7g5ZcRqwZbPZgB1GXavAlLHnP90ss9MojZYIdifXWpqb/+9JkgwLndGjTb2XgAGlnWeHjJACc0aNFrT06gZ0dpkhkmliB6AEWecFcWyVcoKUJ1hYmtBr18WPquOmC7x4hMEbYqEKqLT0iZSSKEUFxcV0U9OEWqgQxVgwz6h61OFSUER4Kh02McGbZncasNpd/IqmHzUVdXJY4kAHua1+PFjPEzJBTZHDXmhQgcUuaAYZJcYkMYgwRGjBBBoWiAlUQBXWnFaUeWkIYv+0pnT8S93I+5lOprHUAtIu5FZiTWV0F4ZS1kvkpUoMsZgrSoywiLNsdyeZyWl1DBP8hA9JPSWtxcVESlqXSfOEh5DWwlKztAp1NFtQlEt6AP9OnXIi4NHR8soOnAWbEDESE8q10jWtU0liInXPMKEZQkF6VFJEdFm1jfVpc+gaVGg1ZsPCtYB1yXELokgGopwTakjVGRaxW0jZEZlWjg8tSrR2MUr4mjE8IpymwvsLOamMgf01PFcKeo6TJNWvWmo/1qIVIheltTQ6samy6rEIWHgzlqqvb9WRKxnMQNUdZHAZMBpFrCRaPLgGFo+jiJElryRRbSBybtHJY52uSNRS5A01iW8sFbg1EqK6wVCT63PnuMY6R9YdqerAFXWAAAAFMfRUeQ6ZYiYxAFEYGwhQ6aIaYxaLEjHhwYeMqUQCL/AwtBGkkkaTBF9JDOkmlWVwkh1IeZOwkqBbxen4X5zRYhPJKfoBaAEmOssx8H4n2RsTxPSILEX5XMFWMOUSZXanXIswAiGNDcUiq2wsUfcAyi2spfgJ4l05vHWXElw+h6lzJGkSQlDoSiqtQFsEdAlFsw109W3gjMl7zkPFxeyIJ6eqfXLER6pXLlSWql5SJK8pEo6LWwLURysKxTJLLDV2Urk0qOCGSSLQeR9UtiMRolooVmK9hYuqaDr1zR2OzReVr4wOnraEISUAAAAUmS5aMujVtDTJtfD8bp9Ddyt+I4xioSOO0Nprqco/Hk886ifgNjUevOJAYC2xood+Rw4GAyfY7oGkJltRo6Vhw8G1HjYlBUq6BWuC+LGwMFkX1lhLh9CzmFUmFfTohwiwCUOGBVOaLcBo5nhxnyJANOorBTkzwk1yhBY0IIs0uwt4XUWAXUqmXVLgu2v/70mTAAidxaM1rT2TgZGY5ehkG0B2JoyjtPZNBnjskGJMKOBekcoGaCpPwkgcoWgQImCLDcJmDBSBbgZLKT5C0ynS6IgjDcLqnWJQI4zymFgOMni2nUDEVaOZzYoOoSQvS8oSaltUcFuRKhNjFcBImlASSqMSyRioWxF5YgE8CI7Nk8mLhKrlj+7xk8pdKy18pEovxF15YUkNp49LqVThyxtEq8srGTpk8bQImkyRTBYuUW5zRWXadWswtTPOlcwM4ymS6KoXiWcCcytA6WFbSbi27Y9gP4S24vICR1xz858o8AIHHyMQLhgRHvieSlJqMVLuNHJVT028DgpZiJ7GkUWpz1It5nvRaRwUt0QVJm/AkqdPlskvS3JWYFJOOgGRyzqbMEiTrdKS8xjP7+ptmQzt/Upu736J9Eylb/++jFV//6mZv///+HaoAAAlQ2cbjGaBNUIcOBxrOHHUa4eZcxsldGm0kZKRZpBQmuF+ZyK5hgGmDAyRGgUC5d0xwIjAVgBMYwAKQkoxkIjAgYMOCql7QocIaJETACg1BXCCikr27T8qSTQeDQJ+hBBjiwYgGqSAEgPkDRFeFWKcRJBxtFcrTVQRikYMUWhSizOxFSeyTigZQXpOR+iciEhWk0sYrovwpSEEGKJbhE2F+SkPwhwRknx3CNHOzocUKhMVOmirkOZWOAWF7pbO5EE6N1vVMheU6iT8N0xkOjSHkdabXDKh8VGplWtqUQlULtUoo6T+TsRgLjOr36bYEwhsayHyCuktLg1rs62kVafUomR/kuL8eMNWEJXC4HgK8qGcyyeI5QPSEi1qI4X66Mald0/990pQxfm+vSn3jWYH3r++Kf/EB5QAVyLzXbDohYoFrv0LcS4raxKrSyGvan6akSVE4tv4K6nhM9maquwsxvVWHIQz3vizdWCP6YWPelpTTfsYowq1d3ayQHRJVkYWyLifBPajwkF9H3/+acMoqcfbWVb8x+OPN57mtNu1W//mX3IndTvb7GnN8xvnnBlXMel0ag1Il5wvKBgEKYDHHNBigxJY0pgwhEzaIFaAw2Z0UgLGlqvjBBjBAAEHAJJu4hIonL0QfVRbkjk/URaC/jJVbYkyh//vSZPyCqdJ9RxuYe8CEDsiRYSeOHpHrIQ0w3smcNyMUgwsZmEqXXDC+qV5mJRamp3seJ6n9gCjbddtLNOSvyLuDKli0UWXpOQc/cegWR0TDXBhq28b9xeBIsr2WU45KXhFJBeWD2B4zJo7iEhOD8DVQEhkJBOJPlqO5lEYrn0qg95pMoO41qNepJrp6+6whPwn9GdVJKa2pbxla4vYgomyGONLkSqjt2SQob8ly0d9GymgglBVlYeSl9QOeynNpkRrHsp1FRGmRukunU5vk0myRSBrlcw4gU+EhJ8hcbBiDw9BbR4uzrEQ018zQ72vhuIWx/xFqj7vCz0U88k1b+CJ/DUa/vkJ6sUDdRRiJyzpkokpndWNtHBNrQmdT/9WbG8mVCN3ef0t2zfb/0dV/7flb/3V0d0QriUPFtEp5J0NERaN/8jlRQ3r2MDJDcRwxkiOkNTCDEzScNhbjMzEaQjJwoy8DMCJQwFICoQiTXC24cTg0HBAuYELgINKCVJwa6kAvEAiHUl5kEpyqLBEkipFAiIBesGxHms7UNCVk0aj7odkNxCRXzzjswQ2cEss1BgS7o0MvEk2nmmMmmCwlkQQcKODnCXVnJ0teHxqEpriRYBHiLMCgGLOaJZWgmimmsKQVSvLvgQTQFFAY8vuuyOBhTyoUC2hpM7jBWeKaX6SAFuvOo4mWxN+WtrY6EMUA2kgpibl9PUiHxVnShxDDqZzcaI54l/M4ilSYsM4mqOUDKdisNDR9K4/XFVF+aDnT7xcHIuWmhvIQnmAvyoLeplUW1RoYjoaE5JWxKlYG8XyQ8jPFmTjs7mJpclAokArjFO5XKtpIlVMZ0RVCUTmrHrkXAuJ1Haej1TF6b4R5wUU1qkt5IJGcw08kVEulZIqUssSVxpQ8uCkcSwSvz59d7XavZrkeoaP+cSTQ7Nqf75Z9f9W/lVZN4Ac48OABZg4gaMBd0DBfp5ImAsuBBhP8INP1dBwNlscdGzFT/lWz/rohdubr1Usg1Gw8TyJ5mVJWce9D6qhilvyL1fPR/+ph5RtCSrmmlB3zn1HSLR9kOvvUgMAXVAyqAy740KQ+CUxEk2AkKMjGATUA0ewQYMsCXcSECYP/+9Jk/4O68H9Dg3h88H+PuHAwx45hSf0ZDT01gZM74hSEi4CXakyVZdJuMCod2TV32ZW/KpOtkcAk4+ENRyNAXzjHuT8TpWobMS1EsK2TwuTDHFqFkmgilMYCMbzMShxQ8trahZOYCMbWhYUcQ7FVGQ8xD+UZfWQ/yhHid5YUNDBIKNxgiF8YiODBEyICMAvUjE1yOavOSMi37ezftb9NKyhgHVmF6NExYRKkYDMJWJFPMlggQG1iChpG9CR2YZD6SNYjpWlV8RjC2tCYimfRzRENPEpYPj7JO03JPpmTRMRDrSyIECc3FlXWkgSLB6tRGFAoaUgD4eIxVIgciOnFLevJoiHO2PsM0ZJ16QIJBYERUPRhl3SeNSa1WtuDYf/5Xg0bH8QTf7X/yY3060vKuIhlEVJSJqVVaIKDNQgcmYUxKiTN577S/7KzSdXNFF+Xx8rxRGv3WT5/voC6jrrNUmRn/6inL9AvOqP9MjAuiCaKBBQgAB/mIDDGoMhiIAHSqDB00w6QKHTFGBQIjwz8aaluS9hELTPGQJe1rCqitbeMBcAmBhm8hgLQr2w4wPgBkFOoDgYjwKgQIl6UHgrj+JmXNCh6wtJ0tAt5bToFacVBGVcJhgwVyZaeLuVDThPB0jgTobZ5HGOFdItmOxHE5KMSEbSjIWrFWjTwXRXkyVRhqRbMNCUMZC9lK+Treu063vj1TaWOkw7D8dmYWmZeKB8S7HyEhjmTDMcz1XEXEZ0IYxQIyOVnIysXD5mEuFoWyfEY+O3GF5YExKV2g7KnE0klqASXzgTzkdE5yeDxxLUB6Ni8STlWYDQhkwMkuIY8jgawlI5QTsch2Uk4eFZ4mEsvycH6Y4HwbphIIyMun6o5eQVI4LSWcDSYEY8WVTRrD8Ok0rByWUv7wSGRxGd+UXUOvBggKsLfwtokudWRMYUYKVmIMYCjDOwsrgMElo5BJamODeKAz/h6IHD6aB9vlFx34yLfOxnwi3DZTRnqHRnloHRh9RFMZZylGDs5+Ji740WOjZGEm1cQj87+4qXIKFPzGMQTOCY5GQBwUZY4I4YgKDp0zYgBagxqJFC9hhVJbBAGqqFyo8dTpgAgyoBAJ1ClQf/70mTpA/lmf0SjT2Twd+/YUCRFWB+V+RiNPY+JlrxhgJGUUDJTlxLg+Jq1HppIHIohgZJwcaOWnFBpyEcCTs3GCoXR0nZKpmYW+Y/YijJEW58uUZNAuRy2PhdIyvhLRkk6Cm2iaQoS3AfIiwBaxeJMK07uvLo7BP54cQMnV1qtUuZstMolLVrKrJnys5hDoybUt/tpYnnDx9MuPLWTPOHRwXj9xt8wQkbhphfUwPaUj8pYxN1BWXFNw4MYmboTqUeqEtxXepcw0cbPIlJYMoCUXGXHmnWR7HteVmkhvaN9YveocpElHIGFLie6dPC9dfsLI140F0nw0iL1V+hCEt9UfqJHdNyIg/o1fjlIyC+hw8fqPLOKqMaosg9xIBjOV+N4wyf4pOqUqLNbo/QjeyEetbDlZXtyMNz+eTuIJqeS1RM5/UnFDvsOEBjZ2ZtSqTkRuzcTMYIHXwVJEAAsBjlvhAnNkGNDJABcy79cxlRpCKRZCxJH4zQNr6BiVxdyTLRTobws4+D9ts7DjM5UWeRy3aZm2Z93TUufF+YBruy6TpoQ7ZlgsSZoaaFlCXRcHerGBmb21jcDRdabBOiXEljVJ2Qw92B4lTmbSTlqc6EGShq81Jx5FV6KUZfZ2lrLcdh/ToElkJdOKXY22ChqpNJjblLIfx6Lt8wvkOViFG8qGdzmV6ERUGm04qmVI6clNGYk+kEc+gKpihJ9ziuSckesKuOg/HqBVnW1U4lM1GUssEs6dULyiZRaHP0onJEc4M6dPFNq5kyoYppwIOkJmSPmEeE8gOpivTw4Sj3EHBibrkpOPfWsEwsDVEanh0LURWP49P1vm7djxkkI8I1Lq1tuqyGc+fhGiF5vG97T8IiOLBH/+6nXlQMNQ8BrVwQcTbjBEV1MYkftEngoJ76U0BEDhOfboCH8z/BLYB+sCOaC1ZnDL6IhOzKxI6K211ru4IQjR1NMpVsgNBLjmxgo6rhWQjAA+HDVZVYM552E+ghdKFMnIZgkKQBqswHziHCbgLWadohnBhZUYStM841hgckHVAQEWXWHRSiri0KZ4CSfZP2Ak5nq0+EshhgHuchcS4H8XtXORQHQQoJBg/1acyYZEE9L//vSZPWD+O9+xMNPZnB+L7hgJANAYvH3FQy9kcoAPSGAYxb5m0mcT4vCEwgcyIbX5mkyWLn4PW/HmcbxRNiZuyE9SxvtqFzIo8UGXwdRqJY4GxAq5fa3yYRhSPxITMPCsgiOhHJiOoUoJaRmIknR6WFKwqQlgnEw8PKLgbxJlCNaUWiWTuVmaVIlqdibGlhQRL84ERWhJT4+HqNcJBwJEIkT65DYWDKoVGCyhdhMT9SQiQdsj2wUzg3MGAc4OmxPEwl0XEo9HcceSPj06cq6nxXHZBK3iWVUpaHhYYkkdThwl0gMUTR4Pa0gtF1VgakjXL6Eti97p7rZcuVweajO3WXmU8zm9shfvZTfdaL3+Ud7IL8p9+t/8spisKo668bq+8+mqna+ancqraOtTzsXF6ZcZHYrdRitjpw9WhPsTRbJH0VfQwqvO3X9WOInGZkbzPH9Y8aHkhTSEvQ5wkrlIx9ROnsjuii4uO9kchUJmMpADkwKxMpE1TmeG36WDxkY+DTAKHhASKAmVhXDUtLgIyqAKGP+mc09Z9ey5LsJXqCJ7wt0YCYhE3YeUt+qg3rL1zo0MjAogZ02Za5fCAknHoOMkAzSDgLgjouZ7EIKAtpTq1aT4nRcS5jHHw0kofOidmcTkhg+yVjCFJDDnVRKyWkPWGFCzCP5EKBQIlM0PAYZpOLjAX1XzIRl4ycc0+JW1UpHDozomZHSOXbmWKSqqaqxVmF47NrlXo4iesTvIjs6LjsVIy4VWMJJ1xwYNQHSexIQx3Ok73nhKiVGt10bhg67dRZWhnqpcFGO0OzggrzhaOA4ozBZUtpy0k5lCVwaqovgXFdetqXY3HGCpGuScgIAADAwpo9Xo1ldSCKKV6SjWU6mIzrYw5jOS4n7FFIzMHX792Yt7Loy2oDxiJP4FvHRD/Coz+j/gQl59OT/h07N+IScIpy2JssNbBiNh1hPpMztyYffn7iB//h3/nlC/+4I74AFqwIE1JweESmxFS71RGfmzFh85cLARACeRE+a7JoCjgIScMpm0IwI3ixUUuezwOjBI5ZgygWAzCV5UBL0RNVdpsJo3DfRmzNYZRCctaaE8siDfLsfqLBuqRJB1pQvZCL/+9Jk64M4mn5GIy9mQHcvCJUUw+Jh+fUYjL2XSbc6YpQzDoFGojZzI07RX1aXEfZ+AvlMQVWKNgXMs6MVh6TrnCuSp2LSYmNZxhHGuDqOAHKpjvNZ6qxZjccNP0Wr0Yf7UooMI7CbTxV9/Ccz7Z2F3EL4/uwGJbMzdehJFxIPqIlKntKryEhlowH8cSswaXcWpiulN1BZzqM1TnTpLgdHC6ItqEM/iUPoVWi5VclJLriRaTkt3R6ORcalgrzBAbpiqGpLK8KdmIgN3846qceDYutI1y7o11TEtuHagUr4S3AxS0rUMqsAoxYemdKPazac4SE/Q2SdEFGjzTexBOUT4e43iOwfjz/KjI+2xTx0hqzg2rqXnznMmc6sPkpKO/aTGXHv/yEmh+faSl3LLs2/tLhG8ciN4bERwzlNJuR1C+csil0Tjmvo6X2c0QSY+FV1KYWQyBxhQAABWUyzEFxzWfMudcMUCDIlgFlNYJNw0MkSMIEMMJCogGhzPgzFBliipISShcQiagaJvIUssQVGjlmxK4oV9GxLFJgJUs6WGYqjgmQlw5kFQ0iynsTBhtNBDIrI8SipdQuvFU9xcaH4BGHCZsvtk6X6waUSR8NudAKk66l673LLxu9m/q13/i7NoAk0w9r9wI5DdYjKoAh+onmcjkBBovkothooP16NY+ZDmmKiqKU6E4OSRuJMdl9LEfr5XmCOTEqOtUVwLU5mvNjr7qjKAnx2KhVPHj11TiiK48vHlmYmZjuwpRl1LzKEdmgkrus0bRvIULb1SqqjEtyjq0eEZANOifVnKpy0Q/EwxiPVbyPHXFLFoWkCD1EwTeH0EAAATujhMO5SvGe9u6btuG/g6qKQqZNUZ/Mz2IE9jWwgQZ+m54XamKyML9nBhPMWDpA7/kf/yeubDQkGQjVUOGZOxWHeETEhupaub5K8hGak+xUl+zJfPX6El6XMVOmoUbCblNXL/deoGJuywVaKvLEyvt7u66e/FyU6912zDOTfU2VlWlTowlMAACZwgENVVTpAIzswAUWiMCSEkHwaKL5MRHwAGlBAlOsKFwKLJGxRrU7VZi8MtIQAOCRINbVqJe4v8hKWfXQwQjXcX+XS4f/70mT3gij0fsbDWGRwh0+othhm6F+19SFtsN7Bxr4jqFMPATW4dZSydoTWlPuA0pgaIayU1nSVy6qGrZHpRuGQBeMHODEGkvBLF/rBOy9dLC77DmkMqZ0kL96AOHZkJR8Nh4eZQT5c+cj8hRj0eMGS4/E45WQvVWzDSNbFAw+X7qYI8olpqg5pKlUocP85pxdVY+xQrNE2WHoFitUmOoTmNYsiOoU4dh4LByIOvg1kZRO0YPs04/UxJ5lgh3yUzEiiZm1fTLFau4TZ3pM5iE5GKtBKXKq6RQAQZABMHu5B7uNOksjuVlLq8UFCW56AJf1ETcWZDsTKDwbQweSkyDbngzugk+KH8Fznn8yJnOf2tvnlr5SWr8POX7ciJy4s3ef0v/nCPT/RDCT9Tc5vQD+IOfgwoku6fKtFKvm6yn5FynaCNK2dYm/BwUSnHCQAoZBMGaNMWDGZjGoKOGdDHDIB0kvSMCQAjFARijxc0wQxhaY7FqdXLqp6vHBKvYi0JDo2dEmNQy7qxpEytg7T4RFXSYCyd504qJgVLPLCulAjjtReBdJUDtTRsVyyO3DdR72J+pgF0VBMCaHefqFxB4HeY5eT4LYLgZZzBMD5ARxAByNsh8yFgNRnUptjcYW5xTi4Uc62/bnBhfzr0SG7PY0WdsxGmXb9OMGG2PdLrp1emYZ1QyRtoZ2KOCSCqQsozT0oHWNTA4dMA2XE0Sq8Thw8IptmyNrUYYRCQML4NME1sEQ7MjDyGBkgDTiEu0dm1CJItyFKBtvcmghKylSaxvUK81UKWwFQ8IAAC4AAweYpZV55555E+4NgyCirBmfJuCyZGlaSaawmM9VRKXIkVpNzhs6dbVKxpzVOgRT6CmEUEJFSdWmWS1RBBHYSQzU0jKxxA/Jwl7XvnplsSSMnUb/XyI+U14hUohd39e2kf5kdL9M/rXdWVSDgxBClBZuJpjiQXToAFG6AjnjAmpQeDjwZNK0ghMC3QjKHmzwISzMFwsFgUtRoFakgYwGZLhMGWsY+oIo6zVzlOU7mlNfkY6H47VUk4KuNo6RwizEeacGViJKXxBnKTlMNacOVCl2c1zmHFCN0+hjDiYRhIMt+G9ndr6SN//vQZP0CuGx7x9tPTzKIT7i1DSO4YJH5HIy9M8oDvqJUNI9Y4gxxEufD9PBdqFSEpfqohxfjnHULqcSTMtDapVnbjiQ0oYB1E2aXBzTFXN4xR1a+iqpyXLAtuI0PJljpkNlyiasGlcFM0jJIsYEgOmT9PLrkIcMilglkaxZWK44SHFk2xHJVKMMEJCItDzZdA+NVFNpsDxOToxyBiYiJiQGSNNZljBUlARCofFbGgW5KRpDvkmqgPMUSCJi0OouojpMq+eAoNpml+ebrL06X+2RxjC3IlXwkUofAIJPy3rYc2kA8ZT7USAS+ntdd8oElmsJDJhIkfaJMonvWtZUui0VKIO6vvVStIODvJM+hSVxmJEFDM3j4BRBLgntZfN65Won2afkyfhxz8c3t95D9PPGLaJui3xyzywQJvgMj8GscgWHUKdUEuKEAEWpsqDkhYJMoEjcEAAeaL1AaUidIwTdFaWXpchdRfN24+2rIQ/NGqrGRmVkpb0PUIuZCQzBAgtBrNSZThkCmLaJZUKnLGeQ3SYlzSpoEAFtZUYQ06duYkxfJyxIVhIVPyVRi8NM5TKN1Wn0VqrlWkYhbkuUKUR6DeX0JN6wIl4lEJgpHK0eT0zdOifpLKCtD9wRh/kuHB8PhshnqgezBLEurdeSz4nGa9KQSSOxOK7kunhXEkTm3hFX3XefjwXrGxzQSvaNFxIVj2cpYlCWA6oVyEiUoRuPxybPMnxHOD8qu2Qj4S1QgwDvEfF0Qy9Cv7EbpfHlaqJ4yRlO9Zpjq15aXzWxqWJXn7bLlpwEAABEGIaXLgg9Sa+UpjGvWVVMjUHCsQpmjmIXg6HmMpGZl1b1h+mlAqioFE4LoRIYgUxlSh5VelGl9lSj8lPI0o2TYbSXh3LPXDsgUVEW6ZZRVOghB+dZTX+Z/uyaepT0X3PpRhrOln6JknYz0aUj3XnQb/42Hrc4oDDKxX5yKRq8btBkM+zM441UCANtRM7n1LgeeegR1CCxhULM54wYgFiRWARYewLSOi0Uew7x5kGBUtKkF7RXnicy7QkXR+XkmURXsaUThr1OwwyxtzxWMjITs+Abicc2ROliOIiUOdoJEnaYD9DS4aOyqGP/70mT+g7iAfcYjL2RyiW+olQzC6iJx/RkVl4ACDL6iVoxgAnREV6NRJf45znTWRTKgywWDO5NjewqB2uKL6WP2PtC3qcU7gb905p0rEm7XMqQZVtgyyEsfIxkc3jknkIVCtQxzUaH3fQm2BDQxSMjSn0o5KmOoFAt1dLM7o71ap2qjBCiQmN6hU6OXarOR7ddyNiiQ+OkmOA8Vbs6oyrVbtyqqDmbMnQw5kfwn8dluw1RbVWZwV6Kd71FupIUrEj4jEpHCE5wH75SKmNOsxtR3bK+yIWYZEnux8U0P/97T6/ydq87t/3+7Wf+ZnttJ//87P8fOs33vVBK4WRT5ASIKsurfDKN23eEcsIwvllai571na+mhufZbob++uV0Y75k/4usnW0nn1GMsrl9b98ZGX/5RTzLQ/z91Ygtmykr7rzs567S36/3/uWfGdkv39v7f9p+Xer0QAACBAiBkBjDMdDMZispowgBMw1Asw7IY24VwysTw5le4MDgw4Bg0hT06+Ko4VjwyPGgxqDExzCE23eEylD4x5CUxWH8waBVpBKPNYLAuiYMCA0IDDwCRnMfE80AeTZ6dAwaFRcYHDKrkU07hoMDIeAo0MNDc0uZzIIRMKAYsuo+GAwvGkhVaeHSAxGLTF4TMeAYwiJQwfhhaZYCgsJDovmGAZrbVm+ZMksZJDZgIYGJgMpsywHAIZAIcBRIjBAZAAPWu0teC7KSRuUYIAwKCxWAgMCyqCQgFGDAECQSiCYBAaeSq8oUaYdAD7Ncex/lqs5mg4NgkImGQKNBEwKBUB6R6V660PFZUEaPit7I5+HZ114nDD90sKsNjdipLg4EBcChgLUELgNARMby4mgXwTSXlGZNTuNafpkUKgjHO5Ys83Utd3hvmFlIhoDXwgAOJLGYJiQhiDyStYRkjSngaRA0UbEzKcZxQQxBj/ORLuY583/7w/LfP13////////OHLGFPK7c5+HanPu4f///////yqzZ3TXqvbU1VxxrWsQAAKAQKAgEBAGAgCAAN3RACwH4BLboTsMgOJJKGQYbUf6EvsjsaWaCMsVQCY3v44So3LzQdiL7ZCpaePtTBEKQQ4UfLh1lo9ynZwPa5//vSZPaADQCKTH53gACl7Ak9x6wAHj2jNV2ngAF+GuafhmABm8jHzFe3WxswciTcthlrEw0LZKm090T9aZ5qty95SbrlB6Ket/9e/+GbKuupLkz1O4dNtjnt3E1z+7tkT262zy/eqMSWRZZdDAjPfpYOTIEf4mCQdYs6PDhDIgAAAFumAhHJRGXHnPAGpDGjIA5uDG5imwjFgaYDgpiwZkgAyACBQcGR4JWDhCQl5AHxDpAFZSmioHwXxlC5D1GkN44VadKPbSQnIME+i7GGYS7Sq4TZCW8oBNgYwxjmQ5RTNCNO8hJSG8dykMfKtQ5+7jxENZJWk5zlYmgUkmJBRknUpmFBQoB/LpGj8nIEWNVG4TqEkkNo5xHBRwKWesrJMuW161MMaJVVrhuRzEooDU+y+VUNyxGgwIEvZYr6XENXsqzeM3ftzE/ljPojHAhqW/SShhN89HBdToJVK5SIq0jXdipRrQ5TZcqzv30FnAQAAAEbiqZmZdSVPM/ubKU1//pMCTbJae1XPdvOP63UDv6z78ddS8tVR7l+fs7do2hJU6T1+xAhBad+kBOFW6P1UpLBbP27XHW1v//mvw//9FBqChOYczaiN3uSB83JlRThAAAABUPy0OMSM6SPiOCqUwF43Ys0IUyxk1bEx4s1YoinmBBmFLGLABUiY8SdMKJiAqri8Z1On6BFAbBnWsOlclYCiOwyoOOXHL6DzGkhA1Rg4bto8yIMGw9YZBRfzP25LCoBxIDzN1RPYDDC90dF8txVC1wvmsRB5Epgy70mkAIyZY8uWNSwAkES1DSGCbhVFyPVFtC0dJLjqFhDDGTUUZBTBBrjuQo3ZTpThzBCjpXR3NCEq1qP+BeIaTMqnsViTTxlVjEplqSPeeEzP1ZBeUaJk6/VLpmVj1+v5o5KVcqm7VHZnkxlJPZzwVchbUhsI302YyQRDcxnMhbArF0Xs/4SBQ1Lo1Sq2IloB2kiQCmOmKpEmbXECaSFL/M3doyQ7x8V5dcPJ/y/7//zIHMygu4yw8eqTi8WONPLpMw+P0xNL0kg8MSwfEmzlliuGdT3mfTdy79ds6E0WvF4lbXegZZTGygkfbkbcqTmuIubWhpmD9j/+9JkuoIIrGjJU1h78G1s2f0FhvJh7cMfDWEzweG0JrQQpbhqy9cuZz5r+6Y1lHSwEADAAE7CUAmjToUBhoNRn8RvSprIZnkIqLMCTMgLBhtZICUiwQcFrcAyZHUw54yZ4suDjsMl6jMWEHJpqaTADBEQgahZCfSc6gRlQAnI9BTJFE2NBxlloTEkyAC9R0iCAyiZkIzCFpVUTLTSQk+rDCVVSiAqajS6Xmy9BEkWEWfZClQRXTmJFNzS9SGZg8jbrBMDb1fiFbU3Uoku421suQguvpej4OfCJeXtYQ50IZUymWO9HX4gepDUuhwfZwykhURsiJeortkJvFnsw1VlCiHxsSttYhIYzsKkwaJWSkWmzpltCmWaGkkb8GIRQWycVLagQmVEaR1DK0TZRvCEjlBmdf//+ofmoIIMg/KAP4fDIaiAIBBBlx7kzmcnz1v1//+v/a/5X3blacFighRESOKFg8T2TQ1OknpbFa5KnmjLImIppbCeViU0p9l7qZzpsXFmCNTGjUcc3B2O1600CCmUiaLFRp05wabUlqa5NcU0uIjIqZjGdDuOk6UUcLQIkDerIm0J8/9KAJRAADh1IWFTFAMzPQKm2bUWGsthtDicwZh2IbaTGPCpkgEHEgCQzCjUdAmUEIYlgXYIiMKFCvFlGZ5rQm4nihIFGFv1wOmhwf8ApDEhVCuk6guE6DFjCyWBsOgeZLyiJjPT4Ea/ARgWPUX2yEoGhq1BxkqFxlkEJTdBQCdAeAaI7ZamYo4Dd2CwjRf0uSloBSpaumOGToazMqPKhV0CgID3VHFtkCOlorVWScdoZhvmUiUGK8cqeOVTnM0KlnhoErmNmX1YyqN7AlX1VCi1gM8z9iVTK1aQ2itWM2lbmRX+VH4bKs+H7C7huS5bo6OgMZf47EoWCO2srA+aoy82Mivjsrj4Uzep1SzK9432hovvqH8kX8j9WKxOP7bYaqiseZiUjgyKeNTbi2ssNqjqFVMkrxzgaiWj7AGQlKEUggU9cWI0zV5/2/5fP//3////2p7TNNm2l3I2MkW0UOOqHaFdMDAhwikNtTeaQMbC5MRSxMOfdQmkzq5As/m0XXIpA7oVdGGTJVFS2P/70mTFAwnOfcVDeHxycQ0ZrQUm5CRN/RcNYTPB2TKlJHYPyIJbtzhVuYnB8lsTF8nsyrKN0/utGxNIJEklI2j5uhgQLAFgAPolVGeAWdSMEbDHyzfXTEBiQsRBQSBMiJMUPgkwokKBlhxobDSghexOxBV61FQQkHuKbCiAwbEa5bGHE+BGFW5OVdK1lVkgGfAlyJSj4ISkzAxMlc6qdQvW+Ad0MGKIlMONbQMTacJXTU11qxsKTIYa5a34LWUrtiLYnOYJi+qYkBs0f1kjP1BC5bfMKiTfuQXgVVQlOOpnOYP6ouwVY/WOOS0PF734hU2/Lg0r9iscNITo2PnTyCOo6ejkgMi0EY7EkbNhmCNsTBSZdrcYgPBBynLFlhokEaBPRRoTSUTPoiKVhYwo4eZgBJKaDRCWZE4VE4kGFQ2PCksQKq+DiXDB+CaBAIzMCwqieJpJihQ2hieHnwWRHkbBClqooGWoAC5qyA1GyBqufefSy+j9X9X7Jsi0fVqf01/tY4gJKkwzDRC2xIbTpweMTBIV0p2sTGTpMQ7GhEOThqkSKloKs3zcJh2dVdfoIoGB4AKgNQkdVish4QSAECAyLDAIMHICNQVArXGZgQZtDI0zNwFla1Qj6lPWnVUCAAGGmBgYYYipjmjjmLmLKYPYpxlfIHGjAbAYzgJZiah8iINUw5wpzB/AHMgsFkhjD5ra4O9HIeHDJGaOBcycNmHDzZMD0NlgCBsZAGFSCkwAxAkcSCGgjRNBs6VwgA0KjSGNcgXOL3jLg1EnKgCLxDXoVBBDbtAw5TUloMVAorBxRkNKeCN0UkWwwNcJqDgoUxRxRpC4mUcseJJQF0qMvWooJYGWKiQkyDDEURHqW7NyA0oAzMOrLom22uBWA8CTJBGg1GHRChRQGtcAnIJy/CdqCxdlB4eSde6lY09xXkZq7D+V33f2UOHDEbkEMyl4oJhLoajV24z+Uvzm3fKVuTCaeGKZ9o3Sw52TztW4+0favDkNPHLs2yQ6/jtvzE82pclsDN+/01trWLrT65qOjhqQuDF39iFmAbMfdGQP3TS+MwI5MIfmLZ8lt5slm7TSuJ0+VarLbPOXJqMXqf8pbZkNW/9a//vSZLMPC299w6vayrBzLRndCSbzKwX7EA7l78mQtGXoJA+Q5PXsu9nMMbMIFmudbYJcmI58giLsp1PdrK+9GedU/1/p6f//RisVgTtqrOXi1ksnTrHbzwjIiINFUK7iNHZelmsq5SrHd5m7djSo03CS6qSkmaPN6XR/qkEDqTKNpA3mY+OY5hz4E2LtayJCT9lJA7YVBIsw9JBkU7TTMPDqMtG1NXwxN0t1PzHHOSZgOWxdMRBWMzT2M7kLM0DbMUARMEATMEAaHRNMLgvMFAVMMAPO9gWWQVStC4oQyZChr9AqIVYM0wdXPTMM8NeQzwQAmBhS+QqSbQqIBopCEU0HSoEJJLDFDwIRGmAKImyvmNCMB6EbgSIJBPAYRreIxMXgSZeQmOZOqRvXqBonXKTZYe8L0M+WskENpjAfRAxcRAQSAAuFtH0FWAORdAzg1ICqScmw4JiVAJwvxXlwKeIyPVISM9SFofDJgVW1Eoi2J+zYZSggMTNAJHGQtOl/cl+ZyPlJ6M9qQ1rZlE5q064KeNM4zjalQ/bGRilVKiiuJ2QHbgq36UZFy3q9JsiitWIXyykfUTl4yGSsyRVse6lQtVn5c6z/ipqIwOag0hbHGiq9QJ076v2NRsbc4IY1t7bdgVFVtKlsVDm4xXq8uIifwpHCPcQABWhLLMbiK4CU5nRq6l6O2npb/z+v/+n/OzCxpo0kFodBFMkrwautzTHeKByFA6OJHSHRI9RxKouu5tlS/sOkmcyhtas/2NHXhr8kfMVq7ifKFZZDRLyDw41qqoiRjHXC/1q7FTSoUzQcM3Rzzsc2hLMnVjtHw1Q5NmkTHA8wFFMLADXKMlYmSDyIaMEEFRgJYBcqyQgJZ8s8IxNJYWQvC5lZFNkegaBKFCYwFd4UeiK0hYcLkLdBUQBIODMg5akU1xRRJ1Di4IOcKCTMGUKAtNa0gaVjhodGmU3NYCuGHQTjgkuC3xeFpKTqVAFACgPeXhSSWSFzQLShBGOo0CRUyGdgoTZ12pTs5L/Ic0TW0TyXuYCrwZY5qVUNPw/bzreaEviCJGp2zx1FzQGyiCXCZHgmo8K1VBXGjq44Nai7DAE/n/UaYFLqVnNqVqH/+9JkdAMbTH/Cg3nCkFDmqQgMI24tPf0IrecGgXO2opRgifiuEseYdZxHTmWoxdwJlmyrE6Zxwl7MohaKj/NEaXPvonosBSsrao4SYUKWS8qpn0feIuyyV33sbdN5fGlXzb6MQfmQPi6b8s0ak0mlgVRRwXJaU4sgf1S6DKKArTbt9NJysjeR3oabi20OMPgKRrBuc6sMwC/K/YOl1l1nKaxM37HAAdpgAKRoxlLeHGDZdk/Dw+5P1L++X8Zs9Dqs33iqAlbA0PBATMRw9Rm07EoPOW5iDahEPunoYSK7edEqeuh8tRY80aMijwAExozUmgSuR0UkQOTCTFhU+NGMfFjFCUx4TNnWzHk01BzX2MHUADCKMyEzDSEZy9aBAH6aUkKPOgoiUsYtMGDZGgY1oQBGGjJWFKwCVU0wpZD1cqCxdAu8oeF3KbJyl5pEYRCBI1NVJDRuraFghd99kB6mpfFv05Q4TXV+NcAAE7hbip0OrTHPLopXP0vBQdXRfpAUpm/5C1boyJfKcCPkSL1KFtunq1xq4yFNd1C584pqX3JkzLHlF2VwIr56X2aynqs1vYg2J859SqA2PJWQw8DR60LhuGVL2HL5Z2p5uSEhp03AC+a0VX2yBHqAJyNI5vm9jGIaYKsIoYpqu9uyPF92uLNdyEOHKk1bMWSSfWEL8ct9mTrueV02SMjWS7DsQI4iwzbS97lpS9Jp92cqHsmguMrZaesPC2pOHtwW4pqIAmQMUirMG0hCmbMnaj6tjRVJsid9kawdJZZfL3vka5WsrldBikIcVRach2bUDdeJxcAQFsFdrbLZ5z1W98/lHBG5YTqYebEWM0fsKOijQzYpVKpdBiKJIrCRJSmW01mbX5bFaqaMfRaEqbLp8kzrSyuQj7+6Nv1sk97EnO36bLqiGesd+ZPClhBKBRGfDqoWAAHgahCwwtogfGwHhDtAGNWCEmJOjFEgChJyoOMxRuKxoHg0aOC05yyocuNnzIYqDmtZS9guGmBBEm5KyNJVOLNbAju+hENegMNPNxJ1T1gG2TckJxDfL+JgXIno3o7ehJxhJAmAniRErE3YiKAdjQSbsWsPhIjeHwgQJ0awlAfR5Bkq5f/70mRDAzpHf8MrWHrgYMAYqARjAGiJ/Qyt5eXBZ4Ci4DEMAdHkQosxym0FCCHHGNwh5xjDL+aYwxYxSByswtqUHIuog+y9IWeLwnSRSpSnvEUYm6ZN9nN1FmeNlD0ohSVO1qLytMQxRnF1TBum6UxjvpB6TrhnIVh5p8nymWIRNVeqjrJQTUmp7wCwH6aRI2BXHo8XanQB5q0WF8OtvVJLXAWpWjjNyOtJ4524iBclzOnGlMtqOPxcHmTsvp/og3hcVChDkpTKT6+jHGCXhWG8VagLnER7EpW4/Zl8vpkJoyzwOFTQNgyIAAAUVnnPdbfdf9VEUZFhtQfja3rfeQ+jNDV58UW9xCgpL9O0+4r9zdPkf9K9/58PY+smh/GcSQF3+ToO0/G6lrgNE4kw3y8ykq3oXEkwEhpsHwtHpkQOSJ3VWY+v+thYNhkjCTw0QAMmOxQcMRajW1NB05QlkGOMLvpzBUB3hoNCksutdV1Kou7RWFOp1qRVWfp2V4CAB/AwwbQiQYo9BOESOAlIXzYKU/HOaZ4HSAdCThqXeirGwZILF2IeWwfJ3xiUl6LMfog0MWtEqUJcpCHmaJMDiLsOhXHoqC9KcpkJHtEHcPSgZAaqiLohx/ocghZSFsOWcpBNU0eCBGAX1FtasZjsL2dCsdneLCix/MI6EQjCxqJBriEI6kz1kViKRikbiWVLVcCFFKXxTSk9RpIXNXlILOrjnsb7giS8FuJmOyMpFOQVxTSvfj/Ks1leOI4i5nDERxPS5q8lanSSNV7kryEOjhcyZro3XZ6m4Zg7VtVnC0GgX1CUmQJPGorUUJVPqFzP9tMAyTRZiekyRReoB/5dMJgD7Pct6pULkeqXb3YAMKQanhvvXsy/rvt2Ljq2/Mjs+5P5p7ffrPYJJfLWa+i/XOp7Qx053kf97+ELsa9/3s+a1Rep1w+GpHp2/W//nOkWdv/Uv8l7HUxavo9FOImYnT0kSPSMvVY5AAGOVrShlAMmBzAR4wsMEJAYoDBQBABSnyWA1BRBWBhUFRDS/UfWjDSvYMSpYlIFaYfY8qqjdBosDQ3CU4liqmQGy0kLIEu0Oc1cQ1RaV7xyGKpSxD1BED4MEEwo//vSZC8DOXB/RCtvZfBhqLiVKCOeY+H9Ew09l8GSNSJUMI0rWo9U4aTYrjrUjYoTgSxrnoOInC6cX5JDJLgbhdWQ0HJlXA+ELVCjPdPJRSuB3l8I85BbI7xQw1Kn2I4LI1VpYupdVSsr6UdPVwd6ghpBWlaTk8nOM2LCnSTiWhmJ0higRS2tK5XnXCZEChijUD5N1QxxYXNOwTxMU6D/EtwKS7HUvD4PBKMRpLID6IjZgpEIin8YtH1ctEmggmolkRvTw9CkQEYCy6NJlEisOpUDgflx+OJ+elVOIBVJghDkRIDJklqgOnxHMzJTUcC6YI0CDQCAAE1iC7nVPqnavm0SOlWYMRnIQ+iPAimIiZCpExLu5dC1YBRiJnbJgozytTMMMqh/uREpEtodhhlt4HaSP7uonjbfea5StdX7R+HeELnl0lMqJ8gpH4fobCdkiEzbF1gAA3gGmiAUmctSbIAcxUFl4KpGSSh3IzYBwQAHMKRBggRgkHU1EcoMko8DnHGeB8oOdiH2YLJepxIxK4kvNwD5L+Pwg7cMc2oCfOQhB3q90P+Q0FKrTjJwhCrUZb0Jkb0Qu1wd6JR4QMJahUYsaFRdM53IYrDZjn8dhyqBXTJ9T7TSSV+YKANFHq1du1KW5EZshhzHnHW1g/kcwxz9RcJXsDZAUp7m6aa5aFW0Lp4+ZES4qtsTkZ89UDHeAp1UTJzRravRVPliXbSu4SlYnBkmHY7XF09HT4n1wklJsgcH7KoxOoQ5SyP48wkuwYOROiUfKR8UCW6uOHhmJBYLSsZr3TIzWoOB+JJLUG0bigfBsVxAOkUYmrR2+hfJhmS37vgwSgYkIbFI0JueW+fC9K2R5JF+vfnSJukhobk82Vyc2npKr8z1Olr/S5wvM9OHzNbJybHYEdM7kWWzPN8yLe/JC69IkTh3tLkPnaXnmXneMZkc/44JVHAmai300FevgNLeqQmIVQi080Q2AaPOI1NSyM2OM0xGooWSkI4y5gOWnwBbM3OKHmWhu+azDKAa5ShGJdid8CLCJFwHnB0tkTwQW+cUeNoMtdGLqCQzDTtPyEgTFdFxUZCMooK4TxxEtpIvHcdAaEFW8ThyWvVSAaH/+9JkNQA3635GW1hicmVrGJUYI15gSf0YjT2PgYm7ouAwjqEQkrSsTB4EMDJvYTD1sOGFJwIxfRHJwYkt9GU9jZLDKx1JIl0iYMjE1iWLoCsyx0DZdZU/xqWElqwvk6HXmdXnRy8mbSt4hWXHF81tlVdhKtxUnPnbKFRjCtlAcYYchKSKC1kFa6hnqo2YbWxe0upVuk2RrTNCvaH7XQy/Sr5mUUN9mhqxE49UeVK5QigTr6188igAwACwnHLx9aX8sUmaG+JkFASm3CAm6RanlhGdbpN11vGdEqcJji2Z6dl2J3OXznpp6mflPE07v2F5XOfupk5w+nxfLK+qk5ucQJRtt2D/joIwly/wu2gZaqfA59GdTNOgIU7812wlHNGAAwANPmBBiIiZAqBkIiFGLPl3THBAqaM6DAgYxiJKhHwwAVJkSp0kjGPAZHEnCiDDJWrtnwf5OiSVJo2nXHJ0ymhopUqdTUg1ZtDS3nmf7UqznT7mo0mdg62h+ozq5EGp4yIgSfZ1shiWR6pxIWQwAwCs9Q1JRLhyaClIbldnSwOpTYIgmCUsPD9ZHdW+YNmR6W4hKN1rrZ51RI87ODKhXlfX4kM/cU2LaxKpP6HdViEWTRSZol8K5rjw0Un7d0FteSFK4pzRCujPkunka0+RD/G+1FJKYYJhiyuK9Y3+8u+U2PWqSemRzRbdpUvjN6PQKbK7N2OHYLk320as5e0Aa4CrTXdSynoJLv67Su/0isclmPuEwMzZehu5xkDkjN3PvLOIVP3MInBCIL+JsXEz+0jOIXFM/Tu/0/bL+f8LS3P6bZ8rfEyp2Qj9TLfpU6xVMv482czs/VZvx8Rld8NN4ooJIjWo8ATOGYmpFmqoFEkEkkOJsTYKJAo2QDggoc9qeJItREgySYpSGqLDisyoIDGF4EgVIxPFUal5VHAYgwFMdiK/0vEvU4Cz8NNql2io67hvOWwMBIhfi1mCZQrhPCdoXIZBK42w1Ynwas2x3gWwJANAR8zhkgFAk5C0QOcZBLDlH/dNJtGBzkgMsSQVwKQJwb62kSXnojERY6wMj8nhaIWbxMSEtKRW2s7kJNPSDYXZoSE4KkQ9Cxb0KNV8ubrZ0P/70mRhADjcfsfbT05QWufo5AQjXCJJ+SWM4TXJgB8j4BGaaNDVC3K3sCnZ6PJWaC5yjbBJkyxQ8TrtrsvIyAqbZLCgkx6kj05k8USAvNKuVFyRApPS8aMECNXzIJ4xbUV7tzkbCGkmOyjRRUgjgpIhZaWXivCKjeOSk1Z9MAkFRATGAICsb0jEpvMhmHLJJR5GbuipTcmIt55mDd0A2GOK6uR1DvBgkQ2pWvS4gAHqqZoSm6b5rCRpRxdxQoxRAUShbLyvEcsVe4p03TIqcuirye/X8lt4/Q2m3bCAQAIsqapCJIFWBx5yagngRLiJE3zhCcIShEKPAmCADRmRGauFwU7QMsBpXJW+o8zvr13ET1eJ9NWe+PT8NMkXO0q5VVTL2KVJpJoqLNaHAtMTif1Vd3XuXGvtITGHpEvJUiXZEVEIYOsAz9jK8SB4CAPKVytJlS+yILOow9yw6eCgywzvwIIgsecWQ3oMa85TCU+XJeBubuF/mBgYreuE/tFH9LSc5rMgTC5aiDbWYipazq/HX2o6KXampFVv2LNSe1ZpsDzLCyacUJZlp00LEzJZCqYRVT42sREJL2TTBsMz8oKTTFR0NTY20XyziJhNNaaIpi8ca30rDYvz3Hbahbuk/tRpB9ajTszYPp0ggEiCIJgER2cw64lnjIYhjSG/6k8Bw670fdV1OOpQowdLQ4bR45LIMSa56LBnwx0ymGpaadGEjb1XRK2cJds3E1FgWNGzNTYUndqchqyj7XVgF7lj/FlZ27xUD7VO0ni9KLlrIAHQUnacrZ/LmC4OEAXgumTSG6GYYpiDlhYqMkUBIEPCJJMuXmXWYk7LosUeMmIfS0olAESOk/UUtmsWpekNMEQ5Tp1aqTtSAf0NS4t5wiTF+Hme7eXAeZSE3MZPG+fhJj3NIupoJyGdcVD7nQdz8zCFmasCYQB/v20hZeFyl47E0LpGtMe7M4IVDT0Z69RF3q/Q8bQYFKAMSwaNwWRIjBhkRTUqlYishJEWqrCNOqatq4GHFyd7S6NaMtWWMIawwtGqypq1FV9XniniIogna78rbaS2d/1jKSI5DNaRPP5bnoI5T+vJDmeMZQz5tajRjwBJAADU//vSZHyCN6B+SNsvTPJw7sjYDMKsHqn5I209McHEvWNgEwpx9ifv/3LoVrDFSBXqXOGxOdI3aloPMKmomTwVKTYxS6nDy6y/soTuVsWc57HYUOl99R5rDqdF6rIb67768GSpnaztKzWoZkNOefb5W1V3WbNWltmaz27aPv7dlPkchMhT4JT995GkEBDH0EAxM3LIQRBkgwc81xkxxhgJmjJjhCxiAWtYABBwEEGQ4UqiiEgmQxvM5j7FEkiB7GSiDUJUQdDGcyzzIyMIICni7rxTklsGIc6EI9di2kHHSOA5RbplgsJpoEnJ2uJwEYEkOduUrAQRWxCcLbCdppJMtBgJpfMI4xyiYmkOJOhHS/oTFbVVCkbgsIgJR6CBOSpBs8hMCohRTbDYmRlzC0GzYlkbLQWZFDJC2wUtV1sIhAqw1NhC+aFJZlXtktMwYxGbPGLYisUmgnHIRe9QsjXY63qf7TaDYMwLtNVmNVDo+vL4mui2vanyervhSMhSzzzY4kk3ttWCoyDM8wy+bXLmtpqzm7nQq8b82dmiUo4S68lJpLnUsO50dMoxguLGrGITz5HoMVvba8vJWMUcrvV5X8zKq8zGmdz2LV1KyPRDTXat1kdlVu7ZErbJsyuXb90ulk12mh6DXRBYJ6luZDOIKlc7HB62ApVECSMgHZoQY6DTiKiUyBq6GhhqaUGdxpiqNYYPUhs3VnItrGAsl3Y0LjlILmA7A9z/ZzQJ2fQNIbwGUcMMpoRjgti3BIiUHWp4CLUBAFG5m6cJTP4B9I0IIaprk6DmNdAmSk06WxXHWTkwzVL4ztRbjwZjrPNzTp7xkUpISb1EVzi5MEZTJ5LaYlIzQWN5NBN+mnGCrYD7x300Z/h7BdQWRX3z9Pb6pDmw3QWyBWCwNmmLEFizFbMPsvpMxp523FvWN94co8fDxlevXJ5O2uc0kjfPmeM6bLRJtxN5Vj19FrDmYKQeuYdqZeXiafd/5u25vE08360j4ebn3pygoEUkAEwsNyi2Nmml7dMIw9UPVLwg7UozlLGkMhhAPHUeJhwY4mMaGsAJegschBKHgkfzHJFCFUn3926qjlRXmMXditMrSMvGP1H1T/18uvv/+9JkpoAH6X7HpWHgAGSvuLiglAAz3ikXmb2AAinDY6Me0AEzfRhj//6l9HhBk6zcev7eyTPaiD0BAIw0EQkCAAAAAAdOg11DlsyQqUfNZmzFFwzUNBVGGBRuMUcjcGSiJd5eoGGjyAU6l5MeFgMcmWAhg5KZ+bGzPJioAYgBKGF0TCxgYCDfQs6lVMWEhIbUPHQVAAkaDjERF4WHgwUMiHB4sCwOvKGR0HRyXgMACMpewFAAgCDFyEZIgcgGvDg6AMTdkukqGAnHXgFAAwgIe0eChYCAAOYQEkIKZKEmWl5iQMOgLABUGXKmAnq18EgayH1USSFSCYCzAeIDCQgxYEGkxpxgIfDbMWktOuqigNg0NMlQxX9E2oMybDOMMMxFxAFF6AcgGCgJcxkiJ6Y7OZFCKZrr8TEWe1/ZWlE1OZhxoj+NKauxBnToGAh6R2K6JxSMNQO50TXzGJUs6VNDcN6IegSLQ7GmpShZD8ukyqMx2Hocgh15iCY1E4+6UPOcyh3FkU6ZbrRNzZWzlszUHmY7JYW+M8w14XdfXJmEPu1Yrvn///////+8stdd5GXwLDcRgCSMCj8ZjLwO1///////+t9vWtYOrD7EXYoWuRio2VAxRdrYCEkECyAAF9T6gx8+PmEOD1xiuFp0A2A4EkkVG6BeCoDSjWlUtQX88aGLb0rVFwuHjUc6KVd0UmW7l8SwYUYMe5gpbV7PZDYeCZmXThqvr1PpPfUPcyNDQkzdCutqP2fq/NzCZm6aa3MG1vrZ/r/7/9vXy+m6m3qf9X/9rJKZBq0KLt//9Yw4nDPxjRABCSQPYZLQbEr1v9CpmGz0dGKjVGy79GOoYGHYdGhBTGeIfGhqiGDAXmDgJmBoTmXBoGVAlGVwthxBmEQPgYFD3U0zSIMKJzeAswERXqdk0C5eaQdIpDAW5QwEJAtqZkhnJJJ0LWZspGikwQWgIFAAoFwgOBW41TASQyQLNhRSbYMnITFwEIFzERcwgUKgUDQdHttwgRXIYmAmAlo0vmaFRqYqYiYl1xwFMgDTIAUwQDj5ZZVEAB5hwShyAwUZmImCi4YJmBgJgZWY6CGbDxhg6tdcpggaMgKVZiYIAgJQFP/70GRxAA2wdlBud2AAhJCZlceoACLhmUFZnIAB+TCn9waAARUtircgsnMYKZGTBpopSYYOmShqOY6GmMgoEAiEWGRoBCJfsChJig+CApNQHELhqKl/VzLGi7/WWcgqGMuLhYJCCwChoGHx0HFg8tAJD5gAUOg6PKCwoAKrNZct6VLWiu6s5TlV0YlLAWjLGhqXMqMYBCAGCBBIcMBC4ACEEARhQM0AAAyIipw4YL3koIpmiMYWBRWAS+S23+AQFBTNk6kGGFMKlsCyyZkjtVZlpT0xWPQDKe0lJ9Sk3ypy9Xt/hY////////1zKsTC6hEsBfiEJGYUAQAAAYXhcF4L7PVCFjyXb1n3e0qVnDomMNB+YQicUHzFkUyx8fHS7I0pH5qrNQwnFw0MScMAKAOAWTRcKxIJwpIGLmlRXE08wfkxgLxUaHOaMXVT1dR0w1dzYqDT8xCjM5Icz/mGNk6vkantkTmvVVQxf/9//6X//r+b////ahb///5SpVESQAAAAAAJGRyQ0hgk8F8AVIR5BbIRjGyWdajOE7hx0xUSoCbIQoQ1B7mmF7QuGVAxYQkNXsYggQAxttk/TVJBTKFbZgqOap4jBAA5ggCJA0fAoIArjcgDpXWMdkFFnIwbBxwZnciHcjpJiHmkMZuZ2ilQMZEAxCaAcAnCud3zU3Bpg8Wlg0xgpqJGAYFnTZBSfcKiexh7L3VqyZt2f3W4NZa7JlWPPEmBW4nAbsSGaljZojejFE+7BX8cGWwDnFpUuiI7jEejFiP9lj+Uz9w3MxSxBFSpSUlPMOFEqtFMu9LnHsQ3M5RiVVN2ccqeV0MswpL/NWaWxvcPWKKrKpfVjMps0FHVytT1u1FZZZqz9yrjG61PoAABA0AoAAAAAANq2fbOJGOgToQZNSYMgvl2mLIGBMPHjMckrh5E2OKqaGmocHq1OIZo0+IFDbYmzBe7GSWeOZuoe7pUE7X0jUvzZFrOlGyyqRNw6zFyr1TQ5bqqxBSPz8uO0Wb+Yhb1x6JwVKY8YpXdFQYirNWtpdmU5LKLWUYAAAEqGlVGLXmxQiIoJfDajTPEjHrTmLWJBc0YYih4FxZjgxjQgFAFrkik4i0xjgL/+9JkGIYo4GjMP2sgAGRGiXzhmAAjHaMmTeGTwTMQ5lwQjPjmrGSIXWWsnMCQCoQtcLkFqxLRnJMgIiQWCgoZkJmCBwAhmDxjHIAACWhw9GQyYhQjXOI0RmnAqa7CVSGiPxuLkISxYSpyZYRgoGGUZ6yWYBaNcdIQQEu6CTgAKjMVB0FVkwI2iE1WhKcCEwSghLMstJRyIqHHqgW3LHeaNYlDB3IdaBnziU3uYbWQ134wkMxLovrk9E8KWEy2lmIfoK0923M4yyXWuy2JX69qZt53piX3ojl3Kk5OxV/aW1djOFWU4ajUdikPyqYeuWXtQX9HSPVhTUuVm18NU09eiMZv6oIfxuXIjdpoMf+aAAAsAAAAN0DkBBjVVOcT27emVNHGssgDs9AwSBoEhOAggalckEC7MoEs9GTZMJUAgZIFICWUBl0RhFISWQcF2tGmk1A0mXmWlRiaBqLmIoG3v+jvb0d/dWOhFppKn0TbYzs/S4GgAkiwiZsomXm5y6yaeJmTCxrC0a0vGumZjIWYMQg4/MEMRGCIZmGCYsBmIhaqahoXEwEPjoOIggmEAO5G8OCNCWEXiYhjIAgBsAEIEiF+CYYh2Om6SECp1BEGUtVkqxCgioAuaFkAYJiSzRlVGKhHRrgbAUCTNLmlBmOLISNc+BnpQBNCQkNYUg5hEFfrurAVk7ri6VtqEoLoXxFW5nrgMvhD7uAPIjqoWJQG+TRYDduOPPKo/nMyyNQihhh4Sz0sQpB6LVwdMXB4YcJBZH7kzHHhVjQo1BWJqMhsrRINzhfCdHyZetTKW0JM4V4iau8xXpYoNfUMMaaVUIK2YmS1iZX0bJ24YLWiVeyx9d6C5hWoufsBA5oJwYBb0MzaAB2RkfzDgEmytMA7VVtGjwtuiSP2ORjULI4eJTrQseBoWQGxQRB2gujLFbPraxT55dD93oaRgAOhysSKOnYNJrGl5N39q9YAAIAAP8xgjhEOjTUFNwGsw6VzKbsOBpg0OWDU3Tg1Dz7DW0T4P1KwMwNOcNuaBQodOiJCDhCs5Ac+PIqF4hr4kULFOTw0Kw4WCC4ltYHeAsygMSYIRhBQNBAUSuQ0GlSsAVNWQckWLQgEQP/70mQ1iqpkfMfLmsHCTqzpUwwl9ikx+xSt5e/JVQYkGDCNENIBtWgEpSYJMWjBSU/lcw/YR7Vaw45uDLOkuR1XrpS9qKoGiNFqxWLKpROWq6YyylgsEq0yln9eStyeNJYFRRShsvcquJCVsZK05ykyWxJ7L7f9MO0spuLDGVxh027x6UT6w8YV9ImWspdCVP2ilFYBlsZWW6lBFYRLnCswY+ESflkUA2JbGnYalIXoljAXsYC7N1pFSOwqWPhqbiMoqvU5a7YElsNT0npJU1JpcGO1AdE4HyyW5xCmeuCnCeJ7IIVQy1jl/7+vXwtXsL1jn/rPfd3vmZVSWb/5z87c59axkIAAADetcYwLlaEhEx91ogzbnv+q5mCAm2yZWB2NJz+l1U6fhWlaseX8p18vv9/1y2pr//n//M6r9Hs0JlS2+4zkZRnd6nGhr5FzKtzL4tegBDxhYYMUCDOnd+DRBYz4VMkJTAB0xcTMWOwsDGHkxiICYkRiABAIKYkGiSwgEipvFioAgAacpEu8BhFigQIDDDhShgXQMEczlRGmHFJWIGogkgoVQGDQQmjzBoKVaaPgDSJcMGBBE6OBYEIShYFDkhATfiARdiKAJMYE8zChYcqDorO6EHPTNlBQ0AW7YeXVdAhx1mgKQPsWERxkBBk5LuUDtEj1PQjAtT0qEYW8TFAKNKFaWhSsKIFOnMA6mEviHMA4UKuckZtT7kqlGxmO/UqeZU8eczZYsUVdHWzEKSDGtp2iWz1fc/GR6b7K5G4zPXkqfeIS2NRUnrdvw9fKo/UatncsQH7yC2oUrUNP9dGq1m+X6lXi6oXx/POp23MOEqkUiH8GyNSpwbmhEpUyfV0aA2th8qQ/HqWy/05H5CV5zvNqZ6aajGICUiCjN7MqkLWwqMg4aAg8LiNBkOgM6IgIVY4E4XrEhIRJcXKHuAUnFiyp9dDhuYPClrUDnnSCXzjaq4v9pfkDPVch1jhUSlFtmL1FgJHKYEA4YAUdAkQAAAG3NfcAygwzIRHzeAzQXTZFAkSPLkOBqEhAbCpoxg4hIl8gM4EQNS4QgVmoimJHBAYGF1MkPQEhLxEtFUxwV/F26iiFrs4NJmpBUKGU//vSZCiCKdF+xUNYZPJdBRjpBGJ4Jxn9Ew1h7cF+uGKgYYl5dHgILqdKKoBFJoRpFhWIAEEJSeLWoSQqRClDsqkX+RXhIqBzW/hS9l81l2vYsAu1OBpUAswXA1tdrDn2mHNm2lVXDXy4b8rdeVdsAPKypbbL5hM9+HigBQN3IcgGKtat2KN313O/Ye0NoUB2EMR0sKQKq14ijiJR4PjBAJRXJw5DgqhX0I6QyhOZXBkuH98uPDqawviQIpV8cR8VKS2YDMs0Jiwe5JhfMxbETCIxrhhhw2Ryg9xHMykbPLEBKYIZfeJqorlYemCAJDpYN07ZQxccHh4glxYORKHV95adKoWCycjwekgjsdMAQIAAQyYGoICZch6k1kZYRwdrKz7PFziqXTgkgxoZepejhj6Gxioa6hR6HzI1oobjDrH7e0b7vZFnrBePGzUkF7hhc5MgEBixoLy4HPkwUaeNkx6BQiMDY8XcKgqIpChDiNjLaBCAPapCUQOCG7dCcE1cE2BEIWChk2Lwxygy5RWVGISUre7qKxiQphASqKP6u2polr2WHpUHWxJZpXrPKGK8T0WGLdsjL3CMzbWWfkw0OTgvYyhj6RapWuozv0jSPEnYCUKbjedFhPVoIYHQ5F7HydBfxhierkIAMSEaZKFC+ViSF0GYM8/KlvRLKj0MSyqRqGEugjCXj/PxWnkf0BCkQci6yJU8DjMs6EQhW1Ehrk/ethYS8n/HcmdORG4lpuua4htyMcpzGnepCMqkJPxLO3TU7ZEONlTrBgkhPiyffLD1fhIpfVawwlehxMpjufolsgKG5KElAgnMml9ySzMaZxI+IUjGjUerkG5H4qIEI7lZKl2NYajckUuWBVsUVfM1rXcY4pWpUqxmXk/JRwPY813MCCEEEQKLfEpx9f2M/KIXZWb6TeVRqhfHgt1KDWbfZ3MRSI3V040/U2fVlIPkDO61//t9EXV3TkSWR/76zftKqP0kwbPrAVf1bpb8ugt7MDFSorlQLnc1lLK8mC/DI9AFHCVAAAgGbEySnjRmgV8MGBOUvFDxwRBfIwQ4KC4ZLKFlx0Goem7VTCfpuLdYca0vwaodRL0oPIi0WUofaJUh36T/+9JkIIO5AX5FQ09k8mOrGIUMxaamWf0RDeHtwXG9YkBRiqBqjRBQliVapMRTCSK4b5dUCFQGUPMfgoGpdkjXBxliMs2kKHsez5PoldkLEjJ0daEuJ51NInRdXBKk9N8nKGldGYn8aHZgXzePBrbRvFwb1yX18okIbKszewTJ1dnbxiOpOYJ8Ae0JJbRMg4tLQ5DkWjg9Qk52OhWWlcQL7aIlismF8vFcuA25yIkiCtRNFc3iE4D8b7A/HRMXD0kheE0dyw6YE1WIJSJr9ySiiTVEsJXKLDj0NwniSToUo9F14cBAPnyqObRynQ2lzY6oRgPgnrDM+LSQ3M31TKFMZFgRAhAAcDDGpgO7NuXe+Zlf+vR17u/TUdht2vv/1xWlQXGuXhhZ1YuKNjQMPbRXP1WNf/QWSo9S9EJxXUhRQ9zuZnI6lcPGNR0THIKv5Hx/9SioON0icnhx/s+JzHy0ndLPE9yASBFSArmDES9PYwgtABUOEIkXjoaEEZKHgUPVtIiVVAtbLGpjQBGBmaaxfhnMWQkMKWGWisFSMhUqVsaFJVL25kR1rSeMq6gLy/Eqj7Rn/Z5AssjMFT7AUNnDIQjyogvNaTZFLH4ihwqAvACup0uwMspJQ/hdmVuJ6MPZlQi2N5L1pUmc+Sx3ocaQuJmKpPHui2NRqceZvsg6klI8O89WdSDuMFSTnEfjGzGxEPxUs7xOKtZYVeabgZzElZV52dKPO1mPc9VApbnI6LiklpPLx2HRIpamWeSML82IdOjjBOFUm7I8cTqXZdmVmVi7S8HaMqn1UWhzsajPRbPZDmI0DANE/UwacFFIU6bjZNKy6dxTwJO0J9uUzC7qozvimWrGlJITFbYSX6MNFGw1Cq7q88m2NBBRNGca/yVRm3Zl9WGnEqkLFezOQYLHijhKsN358P7YXUtKWqqk9pfJ7sR6IT0bznPszSaVPmbXIfREf3Of39ru87mMlfub5znGyYab8pUbnPHqd9TL/xxSMLl8IAo6QAA/0zEbOSQGhsREtCS0CpBUJOk0nGImCahMGmlqDBaY6Ri1HVnlUlgGossMxJEKUA9RPi3nmdo5w0WUvrYeSiOZViyKg3WVhN0lZ//70mQnAzjQf0VDL2TwaC/IqBgjCmCx/RiMvTHBmL7iVDCNsKLRzpAyRHIaGEdGqQIoV2Qol7CnS7MI3wfLMbD6MdrSaLiukJO5uNQ0y4TtaOidNPm9jJe2qY54aJG8fquiJFFoeebg2tishzJ9cEhpEXVpeJJeN28N0qoPyyrPakQQKrTCRicnxJEgwRIdD8HjNAgI6GekREsGpJAeviQvE8hmpPVEQ0L6E/CuwjGxMNnTDR1RAWYtCanZPgEB+q0RydxacIB+ej7qhYbEk/NIzRgrqhyiSrkJYWj41GsrD8PaHti+uIi07KxvGVl1YgBNQAAOaDUjlsQ13+XNsyNVPLVVK9q2U2z0rl8lyJhFW6zmfZxLlHR2HynlCm0z/hQvy80+F55HXLK/+TJCC1z/PK9U/sYu855nKitk334v+94NospD92/qKZ9Jt5kfpxCneodp+CBrFJWUkg0hDXNPK0RgGCOAHTNXLnC2ZhVirwQCBqwECgOUapVLVCWZO+zNDS4FvHGniaMZfm0/zLu+VqaXkijE0ZqKgockGRdnOZKbqgXFGsCEpdeseKtLovmapFwwsk7MZqQOVSKx0jES7clOYByPZllJJoxzPOWCzqd6pbBYTth6i4WGAyIyFAH3OeQCFEIB6igmFkCY1obJo0SqWdNgoRjykUkWuEAeE6NEnN5KFxcf59MLpFEQwLCYlIRotRIcNMoB0vZosMkjxkoZTk3ViobKJhuRpcgLCUbUQxFRYPHCQzhoujQjJKBpygqLieCxs3gQSFR4RChM8YVQGTzNHxWwEAZLUBBQ5dqs/Lbi1c1sMRmPvKuS+lg9bjMr0/oOjj8PPkTmITbGBuZhlxVpf5iRf8L9ulyevwq32GN5PGRyvkVIUj7BvRmhG+7LxH1amS02pJYrWZqjkYtXTv5es/9/YpP+G+K2j/YUHlIk9GUach0TjYhkctIjCUz0YtkssFSDqCpSyxIRvErxEaWBxX/cF8VMaBuzFHYX61qi+NLqj8BvEEYJCGgtk0fiuWmmTATjoPg+HItEUQh+VFdIdlRkZRFVclAovPVRNLZNVpCKSmCkdrcQAeQ2qDsUqJI4HB8UsrklBKM1qpts//vSZEABN1B9xyMMTdBsL4iACGLUXLX5HWyw2MmpMWJgIwvBwPX4at75mnE9uWpMlgTJc/hgMxmjggFGtLRPScyUZR5JEQwOQNSvMLpmlKQEzOUKiU0zNMmb06ioaRqzZNNFhElHFSslZJkUGXnZvD2LSyEUmiNkVo0iVeb1JIW5yZFVIU3MJph5WUFq7xyGog4xvzleNqFBAn8g7/RtVIv0f07fQMOEP6jn7u4PrClOMD3IEJjgqXt1Ud95+rmcClwyhSX6qDXkEuKUz/wQZBSV7omQOtqinJBGGAnBgkLV/VmiimWDs5Gbf2OrJHQianDDwbKKJw8Y7SelchZEHQFygA+a5JvhGOMbVoNAOIMmMNBBpAyCMoGkSmsmqXzWGddnzhuo2ejcmhqOHPtgh2ai0kZtGJpm0HSuQ3Gl0hJJDRejVERYXiSsDAcglUBpFGeOJjtcpbHwzeJQsYH0xJDS5etL56uucoz18ypUqqEziRNyZEnBEKNNNKXBI/TkZJwDEb04sCRgzZ0tYSCZzx6LIBJPnkktKLBFOTUcCiFYfxxRQTRQLxHcOGZZ6QUYUB28Do3QoXguRpBhBojlyRLw7FnJa5RoHyazxfpyZImsoyiINiJOElLO5MKAx6JUEQgDjl0B3M7rU2h6tvnegB+j4MROd5CIP5X1NNTVygxZ0KleiK3X3ISNQ8RFfgmZSXodPK+R38nuiFfQkpiqn90dXLmrQpJTnu4tM6GIWgxkBoEYSpMDTRDKK3Ro6UguebuVs4qxmIUDWxZa2kyLKqAwgLHiOQzpzzDOpM0X0JBqvkRpVIJh0JI0nIWMJIoRgqGEV4bolgzRrCtNI5iCuZvs6H3T5vIxLIyEYB1wC+uCyrkoaB9uUA3l2vohsNJvFiMmGkUu4MkJsw1SMpxLtUKF81s2GZ0uG6jQ1vKwGdnnUMZjQ+rG9itzkioLdBisbtptBkk3NhznrpnrjzUf7c4encFytM8efUCr2DCjNUDFZJYEs3nmmYHWMzUg3eeW72sbWIdrZ3jE8Tdnl3GsLFPqsesS+8z21elL5i1gTTvdsmcYh2d6+IFLWeS4c4ec7g2cNeTeJMIAnodn9mnlF828jtz/+9JkfQAHcn5IZWXgAG4OyJChDAB2iikMmc0AAj7EokMSYAGpe4KIkO0Y2UhLFSZLW2bp5dInMEFEiAgpjFQewt7FzQ0cemlZZ0j0q+mzn7ZykXfOO3PPI3OOXzplSI5+6Z27ZZPDuT0mJxnI6V8OVpEcSHH/UvWlVlNGOpGMFI72bCbjwRAEEkAAkEA1cUDOgpOLDo0yXzOwROcv83g6jH6nMkCUyMbjCBiAhLMtlcwQOjBBnMoBkGFoORBuhohQltAcyKg41BsckGDNmYCgREYIYZQqRXwEfB24EsBleZgeY8cbQCacUYMswga7BHMw4AMoGYHkB0x4oyw8yxMtcDQINDGIPtzNjRO6rNGrNsuNALVwDmKpCzqtoiDkQNS8x4Z5ACGEYIQizWDDVNjQEDZowCrTsLWN3dKldEtoXjZAhqm6BQhgxTjmnFm4IGHIgZOcKYch0BtidUTd5nKMkdUCqPg2EAik82dylMpKVAkqsY0OZsaXLUyViW6i+IQI0PWkQAYQXuRHfBYz3MASGWcXgYSiqVQMBTDutiplqISJeW0dZ/8oDa8hY7g8Dhh22TuK5LGnCS3UDbGtFc6v3hdJkLGHNL+oiMDYYuhCeyGgfRJ2dRVYau5KNHdDNEBOhjDvrUTUagyldKliExaoqCT7RMbmXEYcjEpspbHX7rITXPbH///////+xNksmm3HROaW/NIzBXSsDIMGtuD///////+tZZFE+TZU12GrMiKpJM/C5VM030uB+TSMnDZIjjSmTrxSQNTO2tHx/+f9eMPak1rj7T07/uUbYIjEyICfP2s+TWGAnzKnXbvbzXLLBwh09yIbZ3b+t9bxd7Drt81/53/xisiMn7cY/yMmM39/VbrRPgr5bNj6z5O/GrKZ2tvGedjmIqJU1mZ0aXrZf//////Tp4bxKNNW5n/////+481z0MZ8oqHVAlzEAA4A3NolODqNoCA1YLTD6qTYFTsOiRMZ1CC0RjGJsoxm5AIDhYod0qYhu6IyeFWzKHU2FvDwkNEwKcJhgFUYXGTUdwVWZVQk4EaAFE0mE1R5lMhDgg8cBg0IgACsANEGLx8UDLmCSDxxYEOdFBi4yEoRbOULMv/70mQ8gAu3ikdGayAAVaaJBMGUAB05oS/9l4AByrcig45wARU4MzN0Y2BQTWBAlJGTAwZOyjKAzFXBzYYcKiLnacZ7qWpcgSODqQUyYwpeR/2cKyLkLvFvyAkLjpXrYL6F02AN0L3EwqSq+VPyNJ5wkMnXUrirtOI5LbEIaKS8C17PUHkEdM2j4IUFsUxHwhpscTflIqJMkZ3Bkif5yl3zDWJQ0tubLlqXX0gSLvdL4y+jPocc2w3ZsE278gdVYjYI7fiMtl7hxSpXhtr9LG4bp8oIvNweOItMZHWchrbhy7HkOL5g2fqWcrkYhmpHqCUy+bhiVf////////CblHEpukn5fa1LK+oBp43////////K5DZikrmpXjYkkPbsS21gAAAUSAAAAHYcwIXoVfh3yr7Tf5XNZEPIzlUUbYp/orxtzIJJExdQQinMxyD1Czi45XGiYfMH462Nihknmx8u8ojkEdDi7yS7NHZvT74XNZDX//8j/tZUeGdzRCUgS3DUXMg8yYQOYVBh1A/SzGIB2gJOQtLlFyE0AYsEJJ8I0iNDGVxFjijC5Lo3W48Gg99F3iKdCVWuTpQ3siYPF0J0xnodpymW7wjFUvLDeXyc1lKum8eB11hNz5VHUZraqW28aLGhGSZqdH6pWRGN6JV60/OZFK5mfP3TGpmJHGk+fuD6IzPkcpmaTF4UdcPmKRHSK2lm5zYpWVcvlcrpHOfUK7KjrX1mPCbtrbkprdufSUgRrXbqXguc8CA9gzOcBihbuyVivGqI2vIDDp69z2uXc0ZnjQnTqY049ZOKlecJCcNMI6zj3X6PNv+phnPs3+JhGLpnv6n/joORc9SoEQy1DhUBc1RqFlEQ8QAcBYuHioXiYmNATB4HgUGXT2Gwi/id1HR4kQk1jdB5DuWvc9zl9DVy6F/Q3+NXNOc1yLHOcbdkMOZh9Js19zGc45Ff/2CF4jYrX6tk2cJHTCgjkiC/JjlwwTHDpggwIJmQFrcZWFiJEACDKIrqJimAwCPEKT5B3w/Fg0j4RCNXlQfivVphn7BOlWpEw2AvyEl2QpCUzdQoShzKbKJcy2oSQl+vt6KKZrSts0HwUEpIPCFU6gAYKD4E//vSZDgAN0x+SNtPS+Ju7iiQFQKeHNnrH2y9kUmcuqLgIYp4viKFmjJhABLOgaExMbPA0uJEBKSgKw6IqJoMyIhERSbOiBIVTqLaPBxNUhNTNsoDiAiTLLRchrqw2poGS7thTZ49BY2UbY3Z7ziUZyefmnizE8gxcNSWptdRBeJq8w+PtS1VnXF8PWN6kZv0td4vKSc1Yq4Zy63VLWDRgsYhumVK0QzpjMpEmDhkJZMV/5QrTNB7VDY0Rv/dIvd3IN+coWuTQdJXYWY0f7ucLCOSHQ9yieCJHV/N/eFGxDTHe47dTImQii33K8o4bVUT9ETuddF9BLE0Q75BSlap6PyfIGR4GyCPB/nORak5Lb0IAO4MNcC4RuFCkiG5EIBSRRNFtKJWLblr4LVKtLpMPagPHJ4oUqSwlzQZO0ArzmISYB3oS/OdvQ129cEUrUMTjxsP5D4ZYGXbOjmAmZ4qI3TWnci5qR+ST4x8uiUhOqS9RhphIRj9FdKeaVItNztclcOiDqKzlDErxNGDK0f/gbFadZDZXCdUPTxuJ5Er55iXfc5+P3WrMRMQUYPjv5SvVs7NTqJ/22V0UFiw9K87e5thf/tLkqHuUhsfOSVKG2HrKNfRvVryPPO4WjKlIVFfukjtSNN83Zj1V1mCrrd4oiWrgwAtAATmNPe8s9XW9lrJ1q6MbvSzRUeq1YORkZrvkaM9Dx3NaDJT4DKDy8KQs7M+3I9aZHofUbaFzgji92+/87A26OtS/pf0JvKdp28zocm5XiyPmcjuCdnZ1MhrlEbUYvwRgpKzc4Tqmrv+rVCKqXBEcoUYNsIxSTyNAoYCLQEmMQb6xtTF2i2pshs3Xw00bZvhajQP45gW5kDOQtBI+Gn1KcBfXaHqmBVVnMT4wz9y9VqZVqvcoMBvRyc2zMMivgF0YGzTPVKvGCJp2+ixF1FWlp8xKhWK9yTpoRI8eO1QF5ga48XF3beh2oyvtdwhTQIMsHq3fbX8qsgees0HD+NBeVmfxYNpd+zWwv40Jnjaefc93F/JZ3TxsRMyRYkRlg3pfbTS0zuCi59eC4xZJoD2fd2KtcOnN/LvGvVqjQKeXfq+t6x3DOKy7zvVNQse02P/+9JkdIAHbX5JZWXgAmuv2KWhFAAzzikbmd4AAfG0I6cY0ADF/1LceLwADA31O/armZTozP02L7erc3UWa1jRgGM4xBBxfFH//9BHo833cbIcv7dyJ1Iqjv/6iTv///6loLmmFVQYYQOHRYw4eKvK1RKIulWHiotHC6FIzKh0iWosc4wIi6CjDDoqpE2OOpEWY5hVGQSHBENAmGNEAFFQ48DDAUwYCJhKIxkgM5nOGRhQAw0F4GFcwUDM1mSo+0awwYCIHAyCQpEQBmUpYmMREBglEQLUvAw7PXNIyiOQh7mHwiQhwhBRiMKlASMYBIzSOwMGxQKWwqBklmHCxDL+LsZebpLosBTFIlgBBRElVpEA0EZb5N0GAAvSatJJi4BGKxOZTDqlIIBQMAJbdN0WDbjwtliRLEEgHfMXg8OM5hAEmQxaYrAIQBX9UCTAQCsRL+pzKqtRUzU2gBrUJMPgcFCNACXfUoRVDAXJY46EBvNxu8HLApyWH4eVwn9gCZZUpmn8TAQSCi1kwBoIgUBAIQVnLZ3jOM6XOrttqaCWyO27khcitSsepnrlJh4CQeWshE5TrThqVLvkzdXnmow9blO60huS6YAZE+UGwJPQ202CIszxiTnt88EVbo0WGF9sEljcXdhLaOolelQsSFuA5sVbu0KET0ri8si0GagJ/68OUj9Q5////////FOyF249HpLnQYQTfn5RJL3///////9ZqTew859DbjXKO1QV43JpeiihBiQoAEAAA9lLksAfvfjHdfXqUJ6h7JhbxcNk6DrLJVbJdCmRhoEorU2upGBQzZazLq2rqkoMAtzQd+13rdTNhfwGwF5AvxxmCbXW/+pu3Ul7f9P/1jDpf/6l0v/ej/V/9tmc6Ax4JHHgP8KhIWYDLCZz8wsWE5FYPAOgEBAMlgQCAICgQDE9symfDfkfMcHo0ScTFJQMikw5C5zKaxM/nc4gsjOKkMHBAyEwjDg/MjpcwEcDIIkKAmdz2c94buUYpognSgPgwOsAOWhNUcNsLPqxJQxCABA81jwx441Z80TQ61YyKozRgRmUljGMzAgzUnDCMjRvxgwOigaFPgpOKHRRGjwOgmHAAkG11+XPBP/70mRKgAwlgtJuc0AAZ8gZlce0AJ+ho0G9nAABZjKmC4xwAgBAMWAqgwOBJ0m9OgaGZI0xQaGoAhUSAAL4AEYqsrhAMYUAIBo0TIAgEChh8iCIjDx0zY1rahwKKQK8kPJfq2tNVSIgxaRebBWQLnVgBwAwokiGDQOEwatQFA2vvy8yoph5YlKoLf2MvqSoxCQJhI0NGhaAAiEID2ISZqagiEt1GsqNOjGGzO0vp2XCgaWyabj0zTSq7ML0clCUNAECSo01KRryfDIUYleJmquT0Zw0NpioGttIbpDauHkb6KurAUNdoH+lVNrGappdTTVJWpL2+65//////////////+p3dFhf//////////////+tUIAAAADV6n1sQwnefrv4nz+p1WO4JIsAsjUolh5yRLrgYww2gYkhUkZeZXTGIioRgbxHTMKsTiSJUlXRIhIgHw5s2SNiacDkCsXHSRLxPC9n0lrj6CvUFHS+sZBG///Xb+bf/If//7EqBCEgAAAAqYwlQrkbkZb47Ay7AtSZkCnZlEhQIBCvIZSLSjKJCClyAZMUcOqiy/oQBHRVByETlSBVDOBUAVOiCmWXeWARSTtj0iROaav4DNh0iKm4XTL7JJJDMmLuhYKlJdlfU+iaoqLMbWT5swf5gidMjcsaKsKnS1B7HafedUCeHXGdRLOZfV46ZTaq2WAZl0ZDRKRhmL1HRdiJU7Xqlmnis7qSSuQzV+9XlMqiUaf2aqz1+tKqeNWalbK9nTW8dVOYP1jhFasa+mxrxWM0s5UuYbnpu9Xv0sKmKHPUvh+Mxq9K4appianqOmsS6V2atWeqfnNWr3M8sbl7sAAMBAKkcBAYUD7TUSTUSrEsWg9JVNmmzf/zzEIMaCwXniKav/GrisTA9G4vI0OOB8LQ6p+ouEQkg66CphuRZQendCP//lP6Kh//+29KL/yrej01//U77uPNOAkAAAAJ4w6ISnmyXGpTGulGgZGAfHEYGdVCMAOrSygJEKGmhOCMEW2JgRQHL+wAXlShqvUhU3Z91cw23ohIEKNZIItpWmFxEIv8rU5kYgpkzttEYiikWekSl0UgFv0vlA3VUdTBghnC+mnwy+5KEWqw//vQZDkCN+VozdNYZPBcJvlpGKlcHr2jKO3hkcFsG2WQkQ255EF2FM1Bmzv7BTlXcIFjsNU0kdGii8/AyXrrX25QGu2HXKjUvROa8y6imZVDMkh6TUMMvLagmIT0aw2OrJkPRkTjaqs6XZkaxt09dYXa29jpJWtnPImn3jqll0ZVPTtdA/EdqK9UuACliAfCcbE2pkTxapcJRiVz2h8XVji54uIZaPjsrNwvMKy+7gqIAAA3WpBywYwqCpfKXqHRweNz+hG/4COSNj9Im0pZ//y3/qWh5Z6xK7P04r41a0+mmk07V6SRNu6bfy+zX8enLHSSOHBABn1HJuOdigcQdxKysFGarqKlPl5YAgAMELCBAw4BSPL6TbrA+7DPbezB4YvEbsXGmu4sYmfB5ggWZMEq5TZCwCjEo8zRrDOt4Idk/FqwxOJKsEFnEwGhoTGIjRTOJPpDVJUuyqaBHVUOEIkA6nCxGyyGL0SFTK5XASRxCgIMglQiZw7YoMvisS+0Ji4Y5dT5xJdzOmWvm1uBmSuNL7TpTT2vE2aUvzHYs9TQowALC0DoQDkgg2PNlUgVLhTdLnoCHMLB0rvHb4rLm+jtZvn9Y+/+3qJk5sVnVqbLbvLcTShufOOrvKKey4yUENxhQbQD4mPXDE0H5MseOtXEuxdOWEh+gjtGcxVf/5dwAAEaA9ODYlcNwyF54Zf2ojIndnVSfzMYCD1l/92woIGJUwxdNtANVAlDmJjiRYVlVQAcyK5IHv9g2UxRr1382K7eH27QeR44Rgd7Nxb7uRCaHecAfsQ/O2REWjcmgLAhqN4deynHH5jM0BI8o0TR4oQpxoZMZYNmCEQCChCBJDFmVBF9JksCZUoY0RciCFMxYRPoqgRKlUaQvEIBgKJCSKLSer1qvGgrVCuleA5ipC5SyUw2YKDRapEU6i9SlKpSZAthSpetKJCqsJWBg9uqVsDui4EFspexeaPTFm6u0sM1p9V0qPQKz2WyBTaWRSAoVJbD8RmfaS6VO11xX5gGMu7bkU/M4SfCWzFLJggHUJEMkqNRCuRNGWCJlGpMgTmdi9y1IUl0y7Ju4LL7jGGzTT58yRoFCatyaTZcltZBCHxyxv/70mRzgwhcfseDeEzwbWsJWQRIjB95+R8NMN7JnyslcBGD2K2mpG5FGkSaZ9Nrwks2nSztG9gxntAQIf//PwhnqLo9JHnub7AAXgFCusBnGhI0wz+zDMRG8zmTpf/l/+Vuzs0MMSMQBFGHiouqCpmrhulLZCTolTB5UUMMNYG1kxbtbxWT0l9vEj6iVKGJ1dFtLi1y+qfjZ0ov9I0hyHnRV5wghbAQcOgERFnpPMcS4L/qJKZQADMBjSZlnpmoZyFZnCYgLg58I0RmTxQCMKVASKWEBIRkUflGFVU7YDLVLucpSlj6JjzLBCwUuWniutWAHEkayUCLH0VntEIFSxaI6CEgbfrYT1YI15p8hoWvx5drIFVaztxtxW1fakVlYC16G0uXeZqy5YzjxGgrvwtuBoPHoAYUL0p44hjyVieOJVgPQ3YYLCTHzCMlp4x5pi2E6dU4lPK1c7Tqj77ao8HyrjlkbLrFUSU6mJlbD7ewlhvLNtPH9VnMcqWokcclFGEx9UhVSsy4tGAcvVloYeK4+hCTglvSmWpDsei6wxNHOb6SvegyZNIQvsi6P8XrgHIQKAMTQABvozgc6TF5TkvaOFCCKAqdjn1983y/ByEMiAgguBRjBGziTXHYMIFqpmJZCjHowUkHCqAxh2UMxwclDEK/HoQKvTQ1mVqGJMFnlsQlRClJRgq8acHA0ba0O6adqGK73LkB3TV0BsAAao6ZUKGjTvRcoY9ODVBqG5hAA4rC4MRrktQocluawZrjG8icZwFSMr0yZBBWSDF5y9igbkNZXkla3JIVVJNFQxTtVd6k41NBodii30zSYtS5H1TZrqwy2WEO2zB6lRJBuSV48gsbHqETx/HYYRqiwQuNT4mtGIsQwIl8AB8QTorsnDw6cHdU4nE9SA0+OToTzcmHs4VUKAeYS2ZQIaw7YP22mPP/Vvu3YleWnNdiM2KIkXoS1IcNLUyGsrZIqdOKHNFrNkKKF+hxMcLGsGZiiZ678TxGJaZM3Q45zrwPJ4CsXjxogfaub0zu5PUip07l9+cmFqlEc/H0nBKggKwAAAlPnqIKqeZdyynIyGVwmAmkIb+eW6nky//CE0Q/SeU/lmt7/Tyf//vSZJUCJ/15yUtZYvJYDQlaBCa+IBX7HK09kYGWu2NgYI/h7tL/IniZMTyLRo0vIiXyhHPP2M7GPi7OovMwzqRRsDMpbg4PBJ+xzotsQykZRBMAAJGXMCVkwAE7cIo0nrNncZHVMmfRmBDm8AmbFmGFICxYQHB2+KA6WjT08B1iGpVxOQ1CSI0kIAhYT4jgToMoRMA+N8qVKkhkH+hyqMNhTzASlKMS6R6nJqnybKRrmbpC5QhCTpjqJfLE9SKFNqvfFxXA7FUoGhdMSQ4LzFsgILplCTC1Em5eeoruojVSykLnnC6pg04Or3nF207yp9eW34Tplcb8hWLXNH9hKgXxrcPtgbucRMler5Us7RedwGrEBdKuN/WzxyeozpTj9KsnzpiZoRq2VytTWIGjC/63X33j5MkvX1KI8vFYqpl657oWkNpJVHN8sks+vclNU7fAAAhM0jNIjuvsjvnH3f23M8v903Dt9PR1oovPd/5ntP+TLXnZf9XOb+ue9Y4xGNl+IQqnJQsyOALVERFsXzz/WcJe/mdsvaPCaOgucy1H0YhQ2VGi3823pQYjl5yH/Aw7vNUiDRqQXZAANIsOjhN4SMwEJoyRZjBYQVMEngIyCFZJgxI0DIijIFXPan01lIJjh6qEkZcWc/jnE7EkLAtgQjkC9JK+LelBrCSolQiQIJhLGaF2RzWDkQoxTSQpfHirY7uhbkHOlcksUiiPPrpteJxhSBypU6T0UylbHSmq8Si7qhralFICKhGmFhMgNCAVvKpsCCfRitYftQZYGBCZnBsohFBCqdSsMPUrAOPgh5LtNqH16YKHw8+ZAkhZXXSHTJIViWHEcDbDkCRChwLvEq5I4oxFJRBr0JM40ukakwZZQJiN4hRFZFsSJLUJk1XJNMOg9JQsiQ60QtPtJkqQKkAvTIKJKYCVSE6m4lGEi0CA24kP23NIx0GzzCG3Ug7mEvXU9SiXdDtRImUnYvBlBq+uzDZCdkQXoxgSzMfYhDf2aqdPLa/MxbbNetf69VhE+tSftkIpNjriv7v6KsGrszdQr4VcoU6ZBMnJTMiwWKwMZuMLOIKFjFhlJUQkYkGigWu99E5UwhkJRUadF3dIknr/+9JkxgEH8X5Gw09Mcl/PuKgYIl4eJfkdDb0xibE84lRgjSlLoxyuJoSnArWpSDGZZTTZU+e0s5DkYtkSc0SFEJsbyidyIpHrbimHI0GZtUS+fiSeH2rYzGqDLRyhZTnSQUUA+ZEDgpQIqNkdoBEK7swQozwruIWU7RAKjc22CI+Q4Ql+0cWpUuVFap4nMrMdx1xtAgnSFBu02iBazzJRk70RdEvAUlnGGCZd6aEUetaFJEuHuT29CtZCnI0Vmjoc8MIjVkh4jZSUo+SOWbE7cVkdn4G2V3H/Bxg8uQLZp1VF+nBGu+cBAAEYABL0qpk0slitsWYNiSkVI8sdZPtP+JhJxTsCgyJmXDMLCf8XUkM+/Wfo0kk0YiKD54JmMrRJevvsgwJXysJDL72mcV6fX6f52n2pc/+/5cL86Vyy/x5nSIYo83yR230eZ7Linx2hLeUqISjSQBAD24IjnUBGMUGuEiBMSmgqHMODM+SMYNDiBdkgEuykCnEpqXVS8XIzoT4wSwmgHGhZ3SIabx9GQ+JQDyWR6DEQiChsNlNUKokqfJIoJlGaEJXRmZhKBtUNJ4iHpZ8QgbCNG7wzNBxH0Qj1oviKO7QmXiHApOlwei/xdc8hmZKRGrUIUOnC2No/cdiHIqqYiQZHRefWTGdpalBuhqpEhWZ3dMmWUx3Fdoe/Prwk+jS96tipMa0flyhKasEpefKTc0HYxiW6WVMHQkNCPTw4w2PWWSybE5Y+Yuqzq0uw09ZGyZlyG0MHsHI985c3LSW9cUpFB4udOVCY0UwNo6wyw2sQWQx+BPM6PQzZlzb33lnpzRhI2HZXq6bztsyfmKb1Fym6aMGn2QnYOoKrED2uEiBpny6Ke8vZLxeahrbzT3aKhVLPLStiMLZlMrFJ1FebaLlc91W3zWbM5Tmn2mXro2lrTOT7MMbCEMMvavuJRNT5PcZ67SV32Q9Pedi0m5/FvcPDTp7ppTes+IyawiQFzkAJugEoO1DITdnGhTVUcY15wEEGOzICUEMhpJIgJTLyZgSAF/Eji6K4YpDw7zTNxFK81RNT0aBwEFHwcpDzOQ05BmPE6TlcuSIUCgVBpHqQtFolcosnji+SywPJdP/70mT4AfghfkZbT2RSjO+ocBgmOGHR+RcMvZHKK73hwDCYqbA90io246S+LhTQXUA/Z29fRaoSSpW1wZSzZCFwjGpSrnlBPLpvAXiYfj2yO6ElKZNSltc08ekpSYRFwJqkx50wHxw2Hc8MpM1JPsI6qYzskwEupTC1UlhuS3qCxLZKmXGSqNYoLFR85NQu0WkZOIxIKUCG8cq0RWWI4juidpGIiYhcdHZVHoc4lxWiJ5dT1aOjk9P6H5+fPHXE9DugmEFSStgWGdmCaseLK+qc2WlXFiQMOYmaTwFcqlAt23O6wbX983XM+xWerzMLb2m7qKapX04CSSyXK63dV3n/lRhyu3n5nM32YX703fD5b+QJ6tcRsf7eEL7MkWhylIl/O8RfTMTf66Olw5t+VKuEGjC2RwtGStglDwXjFPT+6rmjZbdeYMUlZNy6pMgfpc6dENkszHSW0YQaS5CrFSSXGkigBsqnJOeSRhBGg/OgpwBimrUZTI+IENAU0aEZIQAlQRk6Jq81kv+zdrS7p+FN838KXenDCJ8jh/D0hoD/KtPn+w0OMuRIp3JfUr9iUqnPHK8dBZNw5DmgKdBxaqlUISTEv5Mkqczcv2kTStZ3i8cKnfMC620vIGzAZGCEQcJS6QJtjIoFCViwMk64uNwYKLnkKJCKh9EkXSFJRIcIlTsw0kGBTQpUtAi4PkzBC9yesvQAMwKDkESYoZPExRCuFhAUZJhRGQWJ3RUImOGZkyMoBDuq5RFEdBtYSNq0uSEJkoygCp8xBlojNEC42NNQTH3EamhdsymIzRIhgcaaUuCOaGUpSvKfvF/xdV7udX8R6C417MV7mEKMq289ludqQ7JJELsxoi5F7eqaDUWuy/usR66jr6maPoH9XnlRqHLNOP+0pkndJiFaqy/CeORX3b/t3z93Y90m/gorykbqZtNpWPtQ8DOLRlqmTdS2Fr5an7qMSY8tkSiou8JLfE6og3eqndhlosoyJAB1DKrTJMAEjNOHMOLEiIKdA0iXabACthC0PDmEEjEJkfGIq3omJ8r5ZC7DgNLalcdmVwttmkKRdFSx0lOpJuA12tFgUay8Phb5cWgOlgR3C6PCWAkiUOgM//vSZPKBOBR9xlsvTVCFr7hwIEbwIOn5GI1hicoJvyHUkIyZyOJ7YjCpCKhEQFvEVUjPCePQ9lhsohqWFkJyOBkU0c3hQS6Szwcz6hPNIVRDP3B+XvMlU1WNNHR+cno/KFjEK4+VF1pWRoqEofHPocrWU7D0CLkFDQCRaI4IB6foRIvd01Y5fYs1sWr0UNtH50tbMDsT1jihYTo/Vla5shqSu8ypOzcrto094UpEJyRQtSIsM0x1xUTj+VrnZX6q/X4zFacrFEDiFzrZPfjkIkJymq8DYrdL3e1NvyeghDm6NIQpwF3JjxSA0V/R6gpnY3goIKfdS0LCKzOCwZjIdA3yQJszgYiRDHJDCsmiqIhmhFuezMFtFEkaE4VGLq+WgerkcUybQzMxPIEz1fiSjqF2dgQdg0DKJrjuKLYxxP0X6sV9aRAn4OCxcQxX6piTnQC8QAAl0DwcyYpDkbkjMlugVbGDgAMg5aZUUXMFkBECFEIcAfGoGWAlHW2op+JEXk3DNJ84uJuhnBXAXQ1k4dRlIekybISY4jKlJM/H66LGLI8cDkUqFLacazbVCgNwXFkJQdHJ2Vg/D4Sj9e4qLhLDMUE0az4GAoH4snZWeCMCZZOQ6DoXxDuTxzbJ45iOBgmvElEPCE6DcPlZ7g/LSIVR7ovBu6nXrUpTFJ2cNFlDocoL5qRksnJigltVpJJZ20iQZJSx3CLZozOD00KZmWFJ0V5TDw5xdZNz0dWDOFDLJ4MnT+BvyEV2h9JVcJBmJbJ+0XD9GY6JBeMVq0tunTbbjr5YcFBieCH5uuUtHK87LJggK1hZTUGh5LWI8I4NNb+SzvR34hE1kdMS0QKoNvktfxF4b/x9/D0lcuQ/iOJDFXnSD6D2Bp8i7icXGtWRFleWYn+zN8EvB+g6TZ5n/k6pHZ1fHoI9/7T38tFDINkuRS7iaKGZNE6dZw0XKYphGPVA4EUY4q8LB9Q3f+rfJbDvgUHQJ/Fz6/Hm3/LlMGq472BtToKF2DlNMlM9wwSSHGCzYJAFAwUIPBJ2lg9HRrIJDSYSNBxydpjKGnmgcYYKDaZbHDKMDHh5W9PRLeXpvByBwSdIgIkavYZCXTYeXnQKkJf/+9Jk+YB4vH9Fw09jcIZvqGAkKBBhoeMjDOGTyfo84pBjCrmRPBKx+1U2Ys7ZHD8ittq1NfAQtxmWIJDIAtoxEs20pdkaZogIUwUAYg++yYCAYtShKMAE8EA5ecaO2BCREVDUumuJ0Lzc9uj8v9DtZua8Ge1KScjE7HKtuUP5BVmM5KzvgMOB+PRIocRPPMK+hTsFTzxGcVu/6vKuGnLaNttMacOr19WY/jy9829WImnM7NyBRvUrZ27XwRsRzdf9Lv7azvzaJyB3nnevH0xXh6zl82emOtRKDBwfAQBd/d7lUUB7u+CIvIh4z3Zel++5NPNYwz9w8AiH9tkJ3bi0+xiTVgbuUQ3ggpFs8A5zkFGJk00zHPByafgBkyd371BoU0RH7QQzSnIKtDG73vdof9PIf2f0RWoQ5hdArlf+iP8yegR+jt1XkvB5FcNUWUdZzKS6kEdYgoj4ymjHIiCAAMniUAUzDuMsU40gCSaz4OeMp8GKGmCYpxCEhzNEEVLLPIykBbNQYCowkMspLpurNGGOCtAAAixKvm5sNVAkjIlBOsAel0SwCBhVgH2m5AyZoK/1DUMi1T5lzIZbgwtK1JVM2aZe4SlC32kBUKdRQaM27DqNlLAHHY++p/pIAdhWltGAJAUJEj6HpJUdKjU5fVQyJ2C3Mx8qxvZnNdL2ZFzd5Fau1wCvdrRbUa1rTKyViuUPTaxM+odVUu8PAldAAwi4oUsDhNQC0nRaJIfSA6gvDwcmWiyxOKg6TuxNY1xLBrvsXptOekYQHGyVrGIWzziG67FfLr7LovGzU5190F2ggAAjWRqFK1rRrhY5VbmanctdWfijiHzcs+DNuxmB1HEUhwHsMaflsnbiwqlyea5R/lAbgBMLoxOzUEk5KUFaYcOiCyafQT8y1Mwq1nHyqdkX2uZ+UzP7MvyT2+TPP56N//PL3byt//pEtlAxSUg7EQblkHR8ZOOhjtVIfN3J1AU2AAZQuY1aRDAkSbt4YAAXwBTYaWhcoBQAFAiRsWeGKBFtUjUQWqQy6LA1glsioqRViqlpIV9XscFrq8VupiL4igGjDLZkv3qTigAvkqOVUrAWoF1Vcl9phXkTjyaLfO2zlP/70mT0gjg0fEnjLzeifs9Y1RTDjmEl/R6NYTHB9r3jIGSPiOZ3xIrEFMpUthCe70kgRlDdXJ7MSGXUD+NxV45KmrDVtNfmGZO/AdtrlZpw+mhYMhkBbSEg7HDQgmQoTKp9GUNYHypGRkrorrQ4qXgLKYdErBATrhmCaJZBdRQMKI5GMLCm9SWIEeKTLLm2mO8iRIuWgxE1fQpkIqEJEqTik0wlZs0ZLKKLzlhlKLconkBOxhwiVMk1YY5cPrwP3RxJAXmX9FUk34AECC/mgxuv22+3xt75Je2zZ2NS90SRPqiRRIovTbnD8znlHDhqUHphzQxTCSiQfW1kl+sbhZrfGWoYqqTneUma7NKf3VpyR9mzbXh8UuFt7Fkev5TySOXRWxcKId4xfCJ050+U/t2RPvtFn7GCYmplDAgOMOsbLv5/ZRqPFjKXwAA2hhwTerjDBwtDMMTUwLCkwxkAGEaAqCUFIkSmbO1ByhCqm8gIIgs7UjEY1CVYYW1lu7iNigJk0DOgrpU7dlMXbY0rtyl/M6jMkfRtVGGzXn5gSOu0yWirtwgeW2bTatNZ8sFDyRzFpU6rYZM+UtcCG5NFIq0lwYFpIKpoo/leQUTQZK+0fnIadp9Hace9QzEAxdz43lQN/VsRGSQBUxlMsoZBK7NFjKoZnIYt42aaH7ssvVLdSzSU/KeXSuvZ+eqTmMan5HGOU+U3WxqTctodU8Ywnp+pq7TX5FSvF2bpp2r3KpelNjKC5ZblVSinZThJZHbdjGgj1WQzX26e9IpfYna9P+rnJfM00Zypb1Pc1u3STsqzrX6tWsLLF10gddaf+dLrXvGPbFHFEN3+4Nh96jqJXtxIPEfFT6JcpscRFTQgg1VQyFCRIDw4RA7STTfjJETEMxLvEomFSf3u2BvK1jb6GFu8EQtf8T+5gw4fAcjZT4Ix5blwPPbVVGMYVZLZ50qx36F/HF17SKV9JF/IsK/zK1ia70rvsr4kSiNU1X4Tf1/jVVcmPnOQGA0iSAAAcmSBsIUmuQWYlYRgsFERxMjpIoPAAAhmIWmnzCbOLARJhYpAIlCQANCFIz2XR78sKGmiYxZ9lA4Q0AC+IgpNJ1QsDJBj4KTL//vSZP6ACPJ+R0VrAAKP73hwpKAAcropEJnMgALKRKMzHtAAxGkWYgZd8AHs5AihcQ2lzOMKRDGiNwxgaI5kDFuQVEYRI8e9bJkPDyKSnQ41mVPUnCMBhUYabR1RSXcFBQc4KCots7DH1N2KsMEpGxM/QMiS2xUERCICVAQqSr0IEZEFw1NRCGkYj+1yfZog4w+B4fRkRvVOyNej+KQbWwoAwFwFgX0DqxEE3BpSgA4Mz9xl2MufcuGhq7aeTLh4dhUtUBVVm3gYXBK8kE7D24LDw0zqkUAVtR/L/rKbqyZbCpX8YWzpnyZbNWYugrp/FKk0k8FIMXYOIxYRKV7MwbIq5GqKNBXI0uHB02WQyzVprutq27xv080aZatOBmuu8lzVe6RKarPYxSsSYOyeEJfOExH///////+EPG01gbSlUmlw6zCGE3W3c6BFkOZ///////+jhFVQr6STXsmPGV3v80VizO3bVva8ACAXAWQQAECAAABG200VkePv6UbqSnWkQJgkpNgnYsFsZzRET8EYLp6eWs2UilVNrXTS0QuZMCqGw702SUykkUjFzpTKJWXy4NGzFwxTMDx1p1FaK2TSQdCyCKKnY1oMpSlnlJO6D6zqSkjdR1JSSRik6NJ2Z11ratJaKjiLupS0KLmbucWt7LQdVqqm6nmaS3oGaV3dRmtdN1TNSf/+p3N1JGKFJZcm3/7qskyNKoxN3VXYACWwhkQAkFBwuQyijTUYTMCCA3N2jF9lNaFExYFjd6LPZrE3/IDGSlCDQSGQz0Njo7aMBtsABkEAw407MWXjJ8Y8kCEQIYSLG2GB0sGa2XnQ9Z1eAdqZGBnJhoIZQKhgGZOjmssJqpGaC8mcmBn4CcrAGMixkCscGqnGWRxA0ZitmrkZph0ZUNKpmLDhrLka0cmBEJEQmniqZBILjAGBiQwEcNUaDSBARgRjRgYKHGWjJlAmY0pmjghnZIayaGzuhlJWZEeBASAiYFDAOG8mvmJBhiAwY0AGEEAGCTFi0wwvMFHDEx4wcSEIShOFglH4FESbqpjPSsyEXDBNEwu4jQYKEmDgKSY0AIqmPlBUFTFhMxBDBI0YKDAoOZ9J39lS+2dBUKf/+9JkkwAOWIZOVnNgAIHNiYTHqACgBZ89vZyACaIdpgeGkACNcKs5goaAiMygSBwI0AtuWnQrMCAC0BgwCSjJixCYKFGChQCDk0XeQFdo2crSC4KpdAjZ1TQe+lq+vRXbE37UASEZIoOqdt0ACxIcYeu9OVOYs8FQBhqVqCVymBMqTRStRNgJ3lOVLl0t+zqSPi0KpAsANKh1yHLl8OQ5ORun/ud+WWOU/e////////5UlNze5TrKa3ex/dn///////+5ljhlqr0gIBAAAAABbpckTXKgzEeorEzAdBruqxZ3PICM8u88eED6DfYfCuF+hAYYPyMfMPlIovEWeeil1QeSooi2LSC2I4TB6F0SE9GsIkVCUnLIIwsk49H5xRyMnH5Y+mznEw+Klx4ciFRcSnD49D/n9upj0fMU8xE/7f7dEa2d67P///5RkR1EgAAAB3HkKUfAbcitJtDOOMco6sDpbR9CyKYhcEmyMcWSBiRMIpuvFNByUhFsKatMkDiOkzWsqrIEbXAL2slLmAV8CkDNanRCOIEEEJUHQEJ5tKTCTRSvZwpm51IxKGVAiUVN8qCocAcAlEh4ZIa9xhFL5gCGEDMzdp0XsfpW2GaR/YbdV1qzvtBg93Z6VxGmh2s9D3UczYvWLUthuSQ1FbFJuGX1qX70PT9NLHetQ06MqvzkjjkBSqKxV+ZRUnKDPC1K85dI+6xq009HqSa3y9jjId15du9hOTMZvX43XnaGCM73KGM1qe1bp9U+8LlFdpLMprWtWMKWx9a8AgGA0VQAEYgQRWdOCLrF0GI8lhMUpAj5wscYOnFRUosESJCXXEyKC9vUcXIGwsN6WaXOQEsSSZ5IxFTJIy6qJxqRkhErllW0iZWkcT31j6XdcpOUZQrbrJwDgccammgqs4iKXU9Dv0f9alASCUAAAAVea2IFy5ySoOhmpRGpTGbCGSnnENmFEkzAAIzUAVGgcGBwYwIhX8SbUMBPs3BSkwQcHEUiVnspZQqmwxAM6wNYBpLSVnMi0FQo9BICtGUhjkJBAAUHVYXZbzNkzcnYuQqnbu8rjLmBsDEkEBLSowg0RtFFWsJBpDK3O1Quq30LsQt/n7mItm4TXv/70mRIAmgqaM1rWGTwWkc5dxhmPCF9oylOZe3BbxZkyMGZmGtNegKVw6u1rshkNLX5beiVuiwFZszGev7Fb92JSembku2MgFLhbjWNiK2gCUZT8aU9/421nHK2tYYTRkPYCuOI5FYm9KUxPDleZJmC+c0UnhZePEo+nyp+74gj6f1L5VIA/oorwk2ropMVR2fLTkygHs9Li4EAAAABm6wgCxZYTL3Q1vJRJfTpDs5EJn8uUtlgZGj1+CRL6BJF5WzLFa7bSO6OpMAmqIAxxH655iZSH+fFFz5k05YEFdrYtlkTrB0CprsY1mOPfv+Rb/YYqtgAAAFSmEheZJIRqstnDmUdZH534sHoQAcOBBs0NmgTsaQP5lUrGACmFhcLD47lThQOaEEPirAjHMYJgzNUATZVXsadtv26MiUUamnqRFppq+rKLIKvo4rarxay6D4qYvRDkggF1U9IeUyext3jjDzpfNDUPaqBjQRoW0PgRofSlHiY6dFeIKcMhNC3JJvVSeOE/mGdQK5dtSPbliCqk8n0Ul0XgylCf7pEqxqbWZnUqVZYamdodVWqy7Gu9uLM3NLMrHF5LNSWZ9Ddp1PM9kVCL7Pt+dEWI/fR1qjPChPdvI7g+VsjQbJxqBiUTWinZRtylWViIjZWx8pVfqOVqv+U4lUVuIlIjyX/if2A11jYQANvCOZHb0taXj6kKC1SHyeFZcUlNyQsp7/ZJE5y0cOKcHSzXwbQdpM1Ry5Xh7IGoKEZF06DLC4w6KkYcCLTgmEpgChSseEhNcYu7QNa/+16ybLm1+6yxFUQAAAMZPLFgJMwCDPTYw8eNAWDE6E0FCErc0YhMVPDIR4wsqMZMTQgIwDFMFXGAEinFUjAMKsOMnKBFxi0qgLUm707S2IiFQv2gWmgpuHAiEhia2w5F31IhcFACoITAl/nyXkxVFkEDomus4SDbFTPQTOMIM6RjFEKL3hnnWAtBNkMQINBGGwhgakCyah3jERZbS+TCzHyUZ6liATkLel8H4ttg9BPNIUUxrvtMRuPCeqxLq5hKRWn4xJ5xTzefzlAqumFlQpeVdFmZTMDM5ovoaqFNHSxcYNFUpn7NVVLhuVDA0pl2q1S//vSZHQCKbl+RrN5e3JXBRkmGCNMJJn5GQ1hk8lYKyOwIIvYmDnYVW5RFIW5RopoUayzrSPXU6dcX5bkS0qFnbkUjVOwszKeawsOR6q9UohDZGWJ4itjz0vvdXcGzykloKirHnxi8Oymdav6UzS1X+4FxwgAAAurCTgZJjZqmQbnNkRs8e2QvLtJCI8naqegETMGgkLb9NV+RkHFAI0cCriS3PadZdW73Fh/0/Jxf04hYoNNFTpGpIheYCgOEQlmkUGmRd9zXsxZ9ZAyAAORFEKwRTjHkjMRDAszDfjuqTeHRkgZYWYoUYEUnIgjdUukFxpWETmZKjIChLcWFBwdWMkI8KcsXbeVA7xeMQBYGikoAiOl0BirWMQB0KSQKGuxMVBIscOAmSm+g+jJLVD7SIiZQsJWNYEHTdstCnJE2OoABYqjxIAONSvAt+KuS0tiEONJdt6HUuNYW29kARFvGdS513ehxYsYVLB0PN3gGWRa/qjj77yztHGKZ8jBchyuTwKVSwsoKChvrhrPNNTlxmMprVhw8avIjmywfCyhMlhDYMtP0TRaLflwf28YaWOIzxMXDE5JKiYzMwk8L8X4mjSxF6OVisoFk0QMUtFSjB8pwtiWydxITsJ+VTuhDm2puWNPnHHEZnDL8lNhUv+OAIkQAAHqhS3SVtDO/qVqqZyaqVV/mmNlL5jARuCHSlGc2ZmQUKozoEaSEYzImuQjH5PTDak2H6+/TEX/N5D1+DKF6hK+/ErGi5wstOmJcRByYsi9bdwEAAHjgARZFVaMZGTL1EzoENbHww6MaJwhPAI8ZcRmUDY8rGHg5gQmTHZgAigDBAMUDwhIlDFMACIGCIkgIhA5c4Y6URJBhypDYCXwcmZQ4GBCLSWMOGBSMMtZaar0ukKBpqBhqTivGaqaBYoVHJSw5wmiRFSWN5NqodECnS5YhKb8CHkgw2cRBVKMvyraw9UzDYLEQjD5HFFYV8lYU2lSmMi0w5XzT0k2uxAeY9I+y2rsORSrRPzYPA9hFT/SpzFcpB/D+O8mJD7JAuLQ9H8rUMZCEJRuLaeMzYeUMnzchbAWxDDaIGS5XQ08jzfSycSJrHkhZvOTlWx5o+EX9hT/+9Bkf4car37EK3l8cFHHONUEQ6ip3f8ODeHvwVoa42AwjbhS6b3MvyhSDebqvZG1DSlhplYXJPq6nMc12JoVKtMcyzS26VbxFLCcJqfDfDcltiVS9CUDmpkMOt+Qeul2zGO2q2OvspLE5FsP8o6QYrPO0qdQItYwtNYEEAFjHGNGU3MfZCUn4pUUo/vt4//6jC0PQvY2p+uXECO50EKoTKU6lmMb3zFMJUg6LhhOJyLYeDjVvcVkSIGoRJi6Na9Hj1ahNq+dW7KtiZ9Y94mimZ2AmYcNmrExqYYaGkAJCMjTjExIyQSKERHhVgCFi9YEBEpEd0VC+QFMiMNCBw4IGRLzVEh4iSRIkZtQRrAGycY8BKozjLMMJWKzUKFSvbmlMnAgaj7EYACBCISFbaCMgVMBrF/zShVcWat9PZJlO16VfpNAgzFlWKZCEKRldOpBV5gIAbosBCTkPQnRBiwJd+JQJCmBFidENHKlTKLiXp+LgXQgbadQ6WE/mstDmlNlyYTQJQiydm8S8hCuUR0qc9jGN2OtuCHuZ/G6XUko32RFn/hVJxBqNZWnJQxDSVqmnbFMhSIRp+wSlRqkLpAdmCZJf1ahrmpVYXjJfZGQ5D2WVCfqFFKhSAZFEhRN3AkxTKpjZ2o90UVZLT2ci6xCpLdEfNh0rLMoIqjTZ/lwUCien5DfLjabZD+RimbTFLCyp5GOCoMBSItziaAQwIGYl5gQ8MsjQ8zyW5dX+qDvv/zExfbMyJhJBaD0rEGRLs6npEIr5g4G5QBGFh2LizRJIvKAC11Q5AnLWWtWYPmEL1zI7mNNtPVLtCDhoos+JQTeGQIAAbZobY+bQybOIaLgMRjLLDtGzNwDLjBCgMqbMCuEkZhxac5b8zBFkL4jxW0GmseXCni7j+stl4QxdgVCITASiYCRyAZhr8wM3USQmuhCgEVlHkJMp8JwKby5GZGZRwe63J60mGTQKULUpegasuNW9S1riiRkaChLxU8uZbrEIBRLQyIUfw8DHBmF2SwA6CQEahJ5AUTomLYT8WN10Enj2HezpIPlQrAwT0Qi52iYoaynmWA1Ea4k8JwiJkQZZ9KFjNg8DVH+uj9PVXIpDH0p//vSZGiDGjZ/Q6tYe/BaZvj4DCNuZ6n/EQ3hkcF9LePkEYuhcXRxpFweqdRnOmjnXKqcz+LnDaT6Lg4vk20rSiNM4WJjRqKOpVq9ijqeMmkNRV1lDFbRDSSqV4SpCzGP+ITRhfVF3WkWglalFYdS0nUOYz6YjzW3h3IxmX6EkOVSrpdKd0iFej4MzM/SJyFaqVYQeL1QhahfXAQVgAHCqxZFD6xw/U6l5+/5fKvzKvz+mc2gFvIXQRonim3hFAYuRzRIAE+BLfC3fv81lTROFo++af/+R4Z2h8FueGtWgz/DDvl7zmM+6d+vRb3MpJ+Z/v57CgAMAApGNogDaLIywdFuc1QeAZEYMJmDFylQcVjIOMjoOLElBECl0iAQU1aioYoeupNR1mQpjp4DwhpK1GEsETFShWBGXQO9aqqGIUGimrE05LxpkrZRKYAtOM0VHslUoPCJShATBXPIVMy9ycypEJRfdwC3Sg6M7IHbdRxXdlzoLHqPy0hrzPJ+ENKhx/YPanKm0XOzaXCUMAcKwdnCZUCoakkmBObKz0JBiI5cWCg7GAgJzYkaPZTVhwIi8Yhe2S6CayJTg4jdSIEZIgBssMC+uWjoTwHmRPA0OpkoYTjI4WgbMAYyMy0RieXh3PAzHodQKBI4cFkBpWJY0ph2QwaLzM4KhHsHDAkiISaAkcFQajQRDYtlMdS+hlUdlBorMy2tOh3PzAIRwHqwdCR6gSC7QxPS6uMxLLgtLJ01wAUUJAREERORCmgB+bf658s+vsv/1+dqwwsrMpdYoTF6KrGpHK7OVDwgtSEhNKanzsUlkP7K2hs6WUu7HHVS0bTyzo8ly5QdnJmoir2ZTJtbrh2QJ3Zdfe8thhb+t/fdAgELIBiPh7plAHScf5g0jKjjMB5zdxwsGoGQsCgS8ahgqUHBFvy+DFlrmYDcCJEnDfGuK4fqFFsLAjQ8hgE5GeTIl5zjdXx+IUCmNAlKEJND1ZBayUGmOJD1o306L4ylMK9OZqiKoCfOUeZey9neh7WazirEMIpobsC0LiyO5klWVOFgiCaHx4YBCmLLxOogEI8NLqx1JRFCczjRnIil4wMDxYO5aHcoHC5E06eLx+OBoqn/+9JkWYM4035Foy9kYl+tCMUII25k4fsVDT2YyYC44yAxirnKh8XTU24XnZ1WiGOkZ4lXVJZKNDse7EokJ2VBaMCASByPU8lpKflh+EwLpbXIDQ5CQZNF0yLB2Viu8kKR8ULDGB4qceJniRE6ZDmaGZbODFWV46Lrr1yNaVpdOzhg7KZWWrsTc69jIYAABkM9lepe2z8+RaRIscYO5r/65Dmb1TyxT9V0TW0ukZOlantsGY/UqXkZLFrfLuSOcvw61jy0/hl/TC7Tf4Sd/Kbt3VOtOl2Hz/JiKGE3GYEs4HDHzej/9F5ce6kXIWWAKMziDDOIFQlbAEBRAENuKB1IkGhQGIQAdKZqXLRaQOFASFrImLI/vZAwXBMDYQumHXSbvGVZlaZ5QJOdHFOlhE6W6AQdfGyyLmJyMJlXZjlGfB7CFG6MUyh3I2zEWZlqtnF6QEf5MSEVLGS6IxliV4YCGH8J6wKtSnSqkWPhAl8YGtKLs04Q+jkHBJJCooBUpHcqGrRWBEHmyeaFc/AYNA9qzl1Fo/j+NSo7Wjyek1SJh8Uoi8UgaLi4fnyQqICEI6tGsBVDXqR1ufoaUdBcEBaMUheYLmlJcL0qGO5THe5uVxJPh7IJafbNzoTy6PLYcKHRqOwcWmZmwoPTJavDpdZw2aWsPINxNH02hVg2fRpD0RiSB7lpb8yHwtqj98nHZ+cvDyAihcScKFOlmXqnx7NNp6/Tc19h5nfyXl/Mr/ZlPRGKOOq+pmqJuT2GYo2mn3k5No3Z6+U5btt9TmZ0/Tl9LTOd6q9rkrOXtRtVe7VVPuldD2pR6a2DsJCv3kdsTi/K7aoIh2EIDBQYMHVOcIMS+CoARIPGZji9AkxkeUPLhJEtLc8pyQH/YnZeArTdJKXd6hxtp9DTqDAPItp3n4MNQqZTPzR2cjpcK8YMdAH8WNvL6cZfxWms5KpLGEdyFBoAYJU6JUZL1AhDgmEkeRRUwSBKPo+nIsoIiUqBGNIjKnSytLxsYEhccCSZEkqxj6wuKMMKGdDRC4dFgeFaZsuNkQ4fHFPGePkppwvIBhWx3Z1OWySeKThs8eOyaTFpy268eIkUJXgJtXlqEwsOkNaUB3pCrf/70mRogfg1fcYjD2PiZ6/IkAhlxiDR+RcMvZGJqj7iQDCMeGNQD7QycRVqtdMXT88UxqDUmlh4vnI4tOIrHrixUmRpVdUOpIhOExei5h1PQxsZq0dapNo+wGEzDERnXobR+caltFqnr7pPinVHwjIL/PEi+h1j4D2lidm8SpMXT1dkz/YK7GFxrI4NejO28gk/2GVMuNueIzVWyqw9B81rOY7+zDGOWiZCMV+p9jnWO2b82qiKLquInMZtinSmzj0E91Ah6SDT4ReFTobHnwYCDyWaAKAu+RBmGsIyAEHAMZLasrbVFV8zTRJylgDiLyajROVauJScIkpPTehFMXxcocfpJSFMTedipbjAfl8P7RcznV5PGOKjDfMlTrGk2o2Y9YZ2IeWqiYVQ8O6JPpUJ4vPXFbiJ1YdkgMiSJfj8grXIB9wvGqRwSCcfoY5DzEoTlknwFlPCZTCVfJpmnKwhvkBSpoRuM6I9vGtWnxSSFvkRihqB0shpjtYSTqztnx2aL6GHhbRVKp7eNDOzMqJIni8SeffCVoz8iMOiQZCUsPWUeVODuwcMmSZU3z47mllxKPVji+AxiPT05WCEnTDrh1Bz/6icoBk5NmDOXo8Svah8YKujPy1zk4bJZwkNpCOGkO7m13T0iRVYtjL3YWr9P8rMukvaeDdSasEKybyJ/5aH9N82tWLTjcQnJi8dnQy6vEbzMTlWLAW6nAqyBf5hdX8vBtTBC4X7dfGWPSBbnKJqktumaXQHosfDJCYCsQULLxK4dNMY80xjTHLB6AliBVBGSEYEQIbZkkC0spHgGCWXyEWB5A68aA8J4/ACj2TFzRTPQdKpucpkRJqJpiIhKW004PfVHw2HBf4wGwYHJGTwNkveDQNj59aSPvOKishwVOXRYJ0BpoNSe+VOLI7aYXlTyNRhdogZRPjjZPcrkVD2sB5djGIWKzbWFJo2XokNT7yVCuWShFmmGTzcKPQgeZmhjFO8LE6qkVkJHD+UYDKcnk6FEnLHbEhgdfcnqIfCChE9nGWqXmpjDMIKHqsixfCZd8QTBQAAxjK9dtjrIOZi0BTR5MYNq6PGOFzIyy2YNBWZJz77wjl11Iq7aFT+Pzl2//vSZIiAFxZ/R9ssTFBxD7iIDCM8Xen7HYyxN0GTsyJYMI15MVMy+xPvlWQoaxXCNir46s6Qj/yP///mQIJ3QsWA5YLBp/zBH4JqxW733DMXmhuxkg+RrszQbU3FbDdZvoN7ICCoPUUt2TTAqAYkJh1EER2hr1NF475wQOBGBq0ylweWCHCyQUCboLDMSZY86YE22sy2rDZbahpoM1Yis5MwUuUEB7NAvPTkKR3JLflgcmB8Vumw+poHye27AHMRatvpEIcVYFVjJsXcH1ALDDRQLKhGVCEwsWD+boz9xqNp4/WL3TImjZaWcPDxfEJL6ltNWZGwVbTFC6jaUzyKZU/q8GXL9RCoQyJj0W0BHAsiN8jU6WPUPluIEm08VRE50LI3LFx2T1S8220yVMyu5pzYqImJxLB4P61jj0LsaocZSM7cm4oGTLQhzlWG8jOC83xJXMtRARAAGCDPhjKauT4yySrrxc5gzJ+fSyVUhdz+PSmX/9ol7nUQyhnUq7uREM92ugye1IzPut0VC/O+VMS/NN5TPSbty4KFmIiexQvMkIpnSeHl0lHkcMv5oLpcAy46idCkL+6jqi+Ta2/RxJJEgGQUYTxgOGEQCR01w/kSBDNS/gqYmUFRlgy9ogLR2UQAHx0E9E6ZC2mKYkyQWS0VZLjgWwLp5HApjxcXF8+J4Q5OKSkF7PHb0+0sSURKQQSsyhSVUrtsfsjk+ZI6ibmVpY0cybjqBXMjKx5V79+/U0F02sbNdnzGj4cHjlvL9/T3dWgRV3asHbay5tEnY8y4ny2vXCmnVVRiku94hQryR2DesRp9axNCizZy8fb28h4xn23LBmg5iXzEkpvTjNaDBv3kup86q9bNZ3XHxusKBGp4cudZxSJGkeWvLeett+TV4EESwiMyENlsbf8b75H5lP0+nlHDMTOaIUTrINHzjnCpitfNNfNG3ckI2q2V6r6eWZYKOIBDehfbT/33uaZ3+B2gzt2OdSCnSMVc3bAnpDWtOCHGBvkSKRuRkSnLh6EoNK6s7uuHtVkBijQ2NHlohCaCeOShIOYAIAAAAM0gHMcQ6MTwnMxxVMtBJOeysMVAfMIA7CCMMWB8M6hQMfBtMNT/+9JkxIAHXXzI7WXgAnOvmJChjAB8PikMud2AEpWzZHMQ8AAUKA5MKBEMFgNMTyFGSBMTQDCwMqjZipeaMumHphhxeLGhhwCQBIsEhYaNjEAxYNTGDHwgMHRYHAROGFBo5mZiEBBsaWAGLNxhoWYKTg4RFhhQcHDYWCAoGz4CADDhgyhEHQ4SUjADkwU6JQ4aFW4g43RkeEFBIk2Gnqpm5qZ+OmckJpaGaMhjEgYCAGtyRpyaDkQgDAYIPPBCTiFoQAGkg5MKjQ6m+YMAJOOkZzFGXDZpByaApkBIYyOGIhDK0TV+oJ0JjSAgCa6tIw8RBwUjUXHY4MBBho2MBLNgMAMfMXEQaIGIgAkDGMgBgYcYaNMyVRdMLhCsaIAsBPuXELnLPYG94sEg4AAQYRCAcBhAPIxIIR8AgSiyFCsxcABxE5KqilpbKJOfAqiLIWKI9M6IQEIB1hU3Ui2Xuuos0kcAEX1KVQO69rSE5y/7OqeTLEGAVKdGoUCFDlfpqCIBfkeCpIokh6kemqzFrCVohAFXpoMjR8V8oi+betdkrNkyWtrn////////mULXFZY1VSpNOGWmJlMibiySkk7Mf///////1VGlMCuN4wtB1b6Pa+HDVsSFeVPdjoIKEFhEobDFDFdANWlCSFo2q4K8gCGKazrE2e/n1imN28esGMxaxnOYuN+/tvN4/tbFL1zeePCdX/kxmjXbO9azuc4Hkz3xGiDncSSaB9+BuPTfxAdp9yXT1WMiYNBSmiaQq1Shl7XlhPPCxCzalY1ncTWo+HS5Y3rPAvR7G3rf+Pn//f3/fdPr+2fj61Cxbe3kuvq1e8atHRyur+GKDP/S1MysIrVi0KJAAGW1PGNA5CYakoIcOcgJwCxMrYMDnzKTLhgEZM4LjoigshUAZRITdPMc4XeTCPsTwK4WkvrYhqPJUGe9Tsw+2EWtBGIjT9XFEUI0O1DYaQaYLMfori7HAOMvY6DrHSfY3UkW8gY/DnOhXqmRGNu2JglVNmF4iX6su43YbNcCkXW2VXpRqYKvXHxau5GaG8babviTbnXfdb1aGxPJ82hwrTRZ6RY0C2Iza1ekLwKUrqurWituZJL7rTNLvcTYl//70mRhAAdIeEnfZeACdMt5jOCgAFt56ymMvS/J5jRnPCSbjHqd2/kjfEDVNZpu9oUKJh5q3x8ZpmuL0pqmrVx/b4/kxWPRGb+pJFmlam1MH/wxGh3Md31/F9T9N/1f/9/X//8////z/K/tfh1RzCgkNEMkRxCDgYcIKlBgogsPBMHIhBDJFFhgSjDYgWMsxBsmxIqIpmW0CZrseKHizjx6wf7F53Q80YXlSLQj8jocuIlZSD0x2eRSev6sMNeCcbj3yjABNMKGAbkwPzc9JBzTJJljsFOVAOINokWJA0YogbxbaodUBKaAek4XM7lNKW+ZFhywplysoUcCjJsToqytXy8rsfKvT0yeU0VoQs7cHe8O07kuhBcVQnEU1OSciq5PirJosSJ14sOa7ccqnTBBRkRIQD5hIbYaaJEazJA8qVQigdxNTThsgUV2KgVlRxzJPJuqirazln4hpuCJOREt43L9aoqXFfNUh8kr4JUVTT29nJNlqsgj3FXrqzSZibRSj67D5tZd7UpV/sfB/3KnL/+68fufVOntIPZWNnZnlZIEknA4g5wRXajM6VMrbkFGC7N6H+326//+P/uowJK8SybPi1XHnmDSiral7MicaYUOJqO0OPKLPWaNkmWcHxloZTSgYGn405y8ItY3qWYjWo9IRJZPTI8wSkpA8lpaBxrerUlsEb3dh+nRlpqFHrzy59OSU0SFdTQQQapUp/kmb+DCTbaAVJtKpwncQaw5WIESmmjCgSEzhA5IgTceKLNIOoWM4kxAfMKSME8YanOUwUKTh/MDGrFqiqRJYFVOhVKnKyE0IAHi2+Dok1gcuZKR2H5SA0oGPUU980dKrhSKy6i8rpS2Yp1qmiWJOuheSHXGR0nLl3aHzrliudEvUd46H9OtjBzBkKU6cRHz0DzzUD9bRPsZdDfsgro4FjDsxwuKd11bY4XxK5v1d5Ytjcvbt73aUr/2qrbtkDvOibq+0Q4T0qKatCJ10GoBHEQodXVDN4WVOFFeKB1jDUUwt0vpa/5ulHnrt+v//fSEGiRYcIo9VynvXLhz+y56sa60qi+mONDz7tnkBucPJSzR09WxJV1o0NcWq7/c0wfR913ruta7//vSZJeABshoyXMvY9KGjMl+IEx/HFX5JdWXgAoQLqRyhoABDDBSe6L/f6k9AzWzzVYctrDd12dz333O/sXe/+9Zmk9FHOzLYADbqVb8CruJJ0RW5EVkaFMiaqFQxg4HDlMDyxiMUVEaJWUlQjCDtQNOABDQMHqUknQScbiwnWFyoXBNm8b6w2MJ2LR/tZPkSwjFP5qgG8Tsvh2KdWLlnisBcXNgPOE9fnMcJ7sLUfy+ina27gFmvQ1preMc7jiTLvB0WXmRdnNAeu4TPB1FmhTZxmW9svtx9ySYgetd2tBtSPqam63e3nrrOJ8v4tPeV/PLuNqTEKvj7gePi99QIsWlocekbULF42om7QNSR4OItdvKZu+i/dt3jZkmvqfHvTz49M3z/A8X03JTNfndtU1q1M+nkvMBGjGwhEWB/FKCBh4hG8jevf/Drzd///xcf//1//+jxU/TLDPaFHOJyiBCHjRAHBGQKrWMqC6U4RhwoKigwQBPJrindEB8cKZBYqcTZqqNOYQhpJrMbAmie71HNHcXHFk3ybFwctP1cTNJxUm43mhTTXGAO3JH4Rd9qm8qDLS//8GE3W0qwgsiaUhBIJBABAAMFwHowTQUDBpAHMNgGUysUQTnf9LMJ4BMwVwMTAHBSMVoDY+g4IzNnYzMDsBEwAwCTDRCbMC8GIyOyxB43UFAYYJgOYaBApUcaBQZTj+TASi4Mgc0kwYBwwgA4xyAozsEYw+JIFAcEBSpazsaDUZAEMAtmwQDJlwKxheF4YQawqUJgGBBgUBoVC5VdjoUAkOAQiAYwfBUeEaJGAwNjISstUcVoVwMAC1hjqeQ0AalIUAZACYkhSJHOYnA4YNhOCg8EYVjgBpuohl+C0CPy5UvBoBV5Q+qNpifRhKDJjOGIkBJhaD4GENJ0te9LMGa2k0Ii+DBWJV59woxJIg8sYhgFBuAAeQGGEALNgWoYAAOl8XEgl94ruH3qi0LmGt0q7lMGCv+qu78BxplTgNNbVMeXpyNYlL/qAOXSNDeZrby069mqOU6zZ4YexpEEv4re2laC3Fbm+r3vjOU0eir/0kpeSFsObizRx6OFv1NMpW1gy1KV8sXybu2J4nphDz/+9JkxAAObYpFVnugAL7tCOnMPAAucZ1V+b2AAcKu59MSgAAShosXb+WNGfL///////95IFk0NP1K3fiEExrlNF5iGYG////////MCQFKAUAILpXGCoFrrLLmAwBGCwIMEfZVNBdI93qyAHDlEmgAHCQEGVX/0DRmWNyv8wE3Ufp7Eq6+kZzmI8Vp1199e2Fep6+avzXDnjcbFZFe+3rflOSKhiiRmvbVMVf79KsxmKhFmILvWEzH89tC991fZfGuooBcLHatxTzaGqNDiFhQ5xe1iX3qtzki5syRGPaghXgwXF7NTF831XHrC+NafF0GJGeTYU6PT8akLOs0xnMK2PiBjW8f6rX4x9YorF2Za+55U7chHpnMP4hSh63V/AgVugkf/C3zYUQAQAEAdElBYhqMSrVt9nuMcCjA6JDgaQnls26mUF5hx6aQ6mJngXAkezJzkzELMxOjEwC3EjxCoEEhkI+Dg8EAJggia4VGGgBgcSZskjCQZOMLCpnAIeNnPTpl4zAeMaBgqEBAMYOFmOi5h4MlqXMMDCjMzUzUlIgsaMzLmABGCipggGBgowkYckiI10O6m+aMOGEiBkwsiQBgMkBhIaMHAEJRaoAA4ICwKCJGRcQgClKixlgoLIxjBQZQFA47BAgYwCCELFgEhCyUBT4bxBAhE4bZUTV+xdyQEdoZg4HHghHtWNbYBAS6YsKEQIkuhwSDQEu2oaBAFhSQTd66xIDYa7rcR4cAoGiOAAIwYGL8ITC6EhMABgUGJbFykwodjbzbYcidQO1PVZPjKK129SblMmLkLgYmYMAKwbLOFvIOSEWpDaABkjWo4+zWqR9mBUsYhqIQ05VSNTF2N5Xqe5ugv2uW61T7AYB8PIV/hU7Og0SOjwAAACSyAgBQQCscVRDYkIEOwlf+wn0gOEqJrE4p3/wKUmDZYjINrxgSllGWQXli8qCKyUnVCQAptYuLi9LLDRcWb4D6x15S/okJVb8Wju7j0xC7lP5eeJd/+fqSP/+a43943j+P1qflql5NV81///9tAABzLNzcIBICYB+fgkYg2QnzgtRCtNCGKpQxYIcEg1CZgGYQKXJS9LQg5oAgA4oFVGycZgRosv/70mQbjujGaM2XayAAW8bJwuGYACj5oyQN6y3BgJolxDSaoli5GwcZGEgsaIGSYFOkXFAAxlBCw1EcIIMUAhds4tRp0kWMF0MqNwMo2HhR5AYVUuMFYvSNPFyR6gLWhDIiNMwQsKCIMz1EEipp1SBkIiMMHJmCQypfAkUBREWhCEm7QMNY6xGIu6zd6E9Yg15pq81QSVQ51Wt6aRAEDU0PtedRY0MyF06KXTbwu9LIck2EA135azAszM3N9zjVyW0tD2cn5ibpKmFyJRmfjFudh6JXtw1PS7Uvh/LHtimuU9qdt1qWlpp/36uWo/QT9irqmqT0pqwzc1jlJ+X7uNX8c41yzKwAAvLUZHxiVbo367ayReGvIkxmZrMRNUTCDyiQtE8gySBFwb0cHZMi+ETQ4WU+mrC2eXGfdliLpEnjpZdyUbmd/81FniEYOBGoxDMbHP+USGlmPetb6eyMrYx2o2WMOnTzW6AyFgDJgZtjY780pyIk0YBTMhQ08kMvSDHQAyMYECQ4YkwRMI1GfFgACjwY8yZYwAChhSAYUMRZJGBjBJKyNOwNAbMcSDsBnyQjHGLDCM+BvREVKg42Y42AIGuA5WIWIKimpXA8qbtcQGS4BjTJmxJvmZwWANTig48toxmE5QE14M06g0LE9RUx0gy6wamEVmAMcVp0kGcK5oqkWoKqgoOPGhZgMASvTfMVoIBRgmUggUeDriwMm+xl0oLFSUfghUzhTDSZwFlQUI14QBgIWGgoUhPT1RUQrTRdFrjBlnwld76p8NHgReTwNdbVI6rm017XrYjbXbbkm13NbcWbr08S5L425MRaTLpPNSu7fj0VlM9l8Zmo9drS6vLZdLbtiT1Ox+W3s4/dmefjhSw7vmozS52aWYyzxhOdao363/Ob5cMESUFXBCQqOINrrOhgFmYjdkatLJqKaTaquQkJVgGtTOSmdmogmo2kmhfbFIaDTlTiMysfQuPLj3NNeDRMKScstT1pIk8JBtwlCYJHgTGGhZRRpHxQl/p/0jrK+Lg1XSqAAAAAAA7TBlcBRhlSAbIlG2Dxmd2dzUnKo5lJAai1mxrJno+YEAGMDxhg8YQEZcMIAizirE32NuCt//vSZB0GqFtoy1NvZ5BULOmDFCP2Zq33Hi7hNYE1NCXcYI74pXCn0kXjuQMnGqeOgEAcqJI+NQckMBVY1FYjZe9205UrFyIPM2edw3oZ048GTS6kc0ctCQckaWxaQJASCZ5GWLGgVwFMo82ykn/a5ECwmSb49zlQxFHMSdsgMgymlhfm7cJxQnKYMA4mZyclMQrDc+dR8si+9ZEgFhmQ1I9A9pUgJCVdhOEk+KZ7RzzSMgMARJoVHpYhRHipDJXCCAlItIYkPoRDQ7F1gJbnDXHyOy1eoLIlqnlo4K2YTuM1haSt0Xq2yuXjgjmZwqfK++/T2KLAAABToMKjFB2KpzWe7tqX3njWUu7szmxIx2oYxpjRJ01VmGHZDEPI5HabXGjbAQQmRV+SOv0D4j/5XzSqZmshOs+cisnt2Hv2Jajx67j3O2vTqBVgmFhaGKZDikmGp8dn8ldncmJmoyrGs7BHC8lGvhXmOaFGWa9Gy53GOIuGF4zmNAomOQ7mMgNkwBI3GDQNmCAJmDADGB4LBgHQaoWm0KAqUBCYGhWeFp6HUAooRRO9gCYmcbLgsJAMtsYyQ266v01hFEa6sduKXyaYVAWqHSgJIhAEGOMDW4qkTBVK8UHtOR2L1K2lvWkWIYXDNKYo2q9iDBUQGtPO5yxnYThUpYWr1xVp1WCu7tE5kjMpume6Wr+cp1K78x/T0tcee3FrcQE6wqgeXSE+h4mCbIje8PFeqLPbPnntE4XMzksjK0beQnxMrTH7a5nCuFCwKCVNVAHkQIiIquNYQaPFRSsfxsdTijEJOZMIRsVFghTWY1jumuzqOlAoYWxlfYq/s3OCTeY577ijXgreIBrt5wmDUO01mqynlv9/zfmPkfWq6RGRtnn/AMyiFo50l+IRiYdGv3s1/o/v3eeXovl3////TspjzJrwepaROgPtDiAeOKcVRbPez/RVAMQAADILrM8EM4EpzDoWBKUNdjc1UHQxmGGwKYICQQHCISGCgGYCA4kEwCAx4KKps2SyQuFhMKgNDYRgcSEDQy5CYYZ4U2YxAoqCYhAUXEdAwQKqOpcYW4axGSLXVeAVdBAYcFTl2Vwiy34aIxIQAKrT5kcYfZL/+9JkO4MJ4H7GQ5hk8FGL+QkkYlwluf0WrWGTwYS+YoRiifHAJoPUbUBxQuoFJImFhDnpDUjIm5r3fVmqwStrHWlOmjuz9HRYqsK81NmmLvAwFTsQZG6Sba2n6Xy5b8MsuZsVftg0VfP3Jb+QSmFPsNgiZkriIPoMqGTZLBIhRNUMmU45RiQdHYglgkoY9tPvmh2Sl4vP1kWqHyqV8XDWYNiU1cc9IS0ws26ueiOkw4JH4oUQnUVnpVQB2KJw/LyUmj+dio7enThIVHtusRokiHz5gMYEO6SJg5PbHUZVeLhVc9Esh17oYyAAgABvrygGbfFCQvVzVAI+HZgvb19Vjbxtg2pjGpy3UKA9C01ApvQz/jN+pk+eilKy9/kY3lfuj6F9NRuUv/9//sN/KVsGAfofW7ZxqjyPVpIQaDMa+4IWZ14BswogPGK0DToy60BDAjWZ4wJYi8BcYCAC/4QKEAEZAFy1AH8LurUeQuBJwKRK4sqA2rmUrMqCrFHttFnqoGlJdEHDJVS1ZLJ0UYul8/8oRRWHWCJmMQVc2cEOQ3WKMgW+iNShgGtKRhKSicKIVYBCJrOYnIPGnHlHArkbCsuHWoto3V82nU6jj9Po/qyYeddrbKI857J6Rw4yzWqv+V3ZM5U+3rg0L/mY+1OVh+Px6sWS0NaZ8LyAsKYxiN2yGcUV1Tqy6biRCOaoQ1RyTEE8iWkoeitGZGJVXFNILVRukLSGftxIfk4wOlIz3B1NASNoqMIK0lkxIer0EmyTEqVe4wlQLh/BKypXimxa4iE5gqkxxBb9SWi0sHgpGrcRfXMImEOPiAGt6SpE1H72L8Y2q2qZ20J6sp//3piJEHocLGnqJiWEsHQKPE8uc7thBQQbRgosHd6iM1OdsGEX9pPxgbWZPgup9CVbk+jN4R9Pqf+Tuboxzsgxz/otToRttB1Nq1ACewoy+UzRsMrnLAmkdGDNCUYsBzMqxYOIMIMeBkUyYcEgxCCTUAxtcjitmTALhLzbu97EUhFexQu8nwu5QN2FD09zxGGiAwQzhxHCWYNkvBlot0QIXosp/DhHiFMDZALQ7wJJiDmLCcakR4FICAO0hx1KBcKMvxoDqFJb0P/70GQ9DwikfkYDT2XCY8q5CQQjXiFN+xYNPTcBqjNltCSPlcLwdy2XdUH6biiLoXxPn0oS0VSGIScE4/QCQO+HZuYrAZHR+VT9apLKBVz3SkvGo/LLLPI1Dkj1C2yTSykMTCiecIFzJGhpJXqThl1KjPTZO9YvRDo+WPaOuNfVGSo7IxdNsJXvIzExuOp5RlkxO+SmWuGieUpaTlh2h0ygLveVoRGhiPU/n2JNPy6uMXool8SFK+mGV00bLNFSCElDAHBTkMkcgnMtCBu4F1+Zeb/xiPU+9VS/ZA4lheTOV+/KH5TF0wa0OyaZuZ5f5B93AzBW7v88+FlWURgGGKAAKCXQARAYdwf1kQRP/bWFjJSmBHtKkwi6p2kUgnKPOViqhC4NWuJzZhTxkoJlkBw0jaBEwCCAALMAFBAYv2JGF2kgxogiAr3ddpjDWqMCf2BG4rQedZKTK8nSXOIgbAzZMJEqUqC9hxKkXFIn+dYOcnieR7EtNZNhSTSEUJodYApNMCMLehowhAh6FEJdfcjpP03W00FpRLl0uy2odZGp6SZJr8z3DQxGy5ktEHSAQogJ1CQk6NQuQAcIRwNAMCRqapEmA1hiOqsjZOFSnLo2AVHTNdlVVd6ALt2cmSkQpIFFEYw0FiBWRODrAYTXbIZCpTSYFDkS0CA0cKcCirkypUnJyiPTbJKOwZD1k6T8eUXI8bNiMnWccLkS6xYkLvSEBImYN2Kjkk0TMjKwaMojaqZSIBuEIW9JC9qsvTu1ryf91T/X//+zg3mF5c7LDwjIoHEhQzmLmWTiKB+jCqjy6BEqg1SUm/Bi0cVS1Aydfd6p7XphaoC71DMRgw48x4zKzujKYCcRs0NCOKJuUN9hilkVUUE9StUlJK1IWQbkoHFD6zaARmNA8wUQYqHGhcAMOBU5thmwMDtlHQ4QtfBKOLgJAD9FlcCCsM6Ep8voYKNevx0uR2nuszMGX6fMZQoSj2dsT0JIISpGdRKMnKHKXqtOwWQ/DqVZY1qZZu/lY4eHyKwDLnIGuWQUYySwlyNJwZ4E9RIkl8OTJCl0eYl3Mfnsq1QmmkipmqjmbBre2XB9S+dorDYxbUZpRcsYxpdVS3b/+9JkVYAGfntH2y80YoDs6SwFJuJcsfkbDLDcieSyZfgkm4w7D/ONKwKqS2IlO8lBZsylcnGviXVUr25dRR073tN97o4rBlBEBEWJIMrVITGjjNQXekGufr7WSl1+f/3//CqECJDC6ooyyfiCkyIUFCzEl6WRHoEjzSMlolciZ0Ls5O0HLOGHS867oTJElJ6VGQSNMONRvbNpbahr9kLtAY5KiFos91BhjbHSx52NdsPhzjIuTjGQ69OOEaUnVdPa79oyA8w92S8qL/wgAcBhk2GyuTOhS4HKneEr0KlAyE0kDMBMAsSKMAUt+DDC6bqStNdscoXewmD4kvpdjvsNXm0tVFlCmMNwG4Ugp1+t+uxskThx26B4vnpbIpRqu/sHtBbrA+bySOtD4+CnSy2O7hBWtPQ9Y6qXanZifSeHz65WsU86cxr9Wl1YtRr1/LGtR4ldT3TugI7QwESeJegdA2+k3euieiIbalMdA4majgnM8l3hZTOaBivzDaT0ELLIgxfQJIWWWUUW4W5ZRE8tMWPsu51AlzkCDmaIssGm9HseyJMmQ38uAQNLFuxKxxEJKyrCpeVLKiMl7lR6bnKDIvZHya/3/r7f//1XuuQm0ZR8pCI/hDjrQHlVpNpsVayOoijRulEMPSNWCmokHKt9xjLQxl3J2IlIwY1+iRV4IZmvXRaGK90Us6lQb6NFalKmPytamA5/mDiW+qrEUgZbe+hatgvVbdrVIvgAAAaEjweahEqCghZUijB2yTJzxQ8iCDm2SLiOkSionHpOpEuSHKRXJYTonx5HPQu5YzPKkgz1CUNTzIojeT6rUl2d8kFHKxmWdynkdJuDlMK9hfYgwESVDRoaaBoimKkbBQnmB6guo5dMpE2g6zRkwdOIJGedTMSUyK7psKJES6K9KWbxAXk3BOcy7SxLNh5g8rmlUBSMEl4CjWGyRgiOb8Ii80NnyGMJ2gJktKifeePETYuhrEWIYlRVaNBLoWUjcy+iKD2FWkjkVUC75LRFCFGZOIEaGK8hUybutJSByMyxQBAKAIBkPYimuzL0TP05mWd2mda1m61u3+6fpqYGUpgx6sSRTIgmhCJScMdWZONVtuOzJS2vuv/70mSNgKclfkbDL0tycszY6AjD9FyZ+R+MvNPBnDvilBCN+XFhMM8b6++dIvMy1U067faXgw3/WMBYujYxotJsmLKH2LV3TExieHC6JOLZwrF2UWpyXm5MVHhuBPZJIwZL23aQaYCOESYFCkooKSxG9eXPAlRhnC0xcozQHwcEaBjq7x5KPNdLqMnedI5KqC8TTEXlddgJU9SrE8XT5pgt6hMiMpZ47GyTHJZPoNGk/KRHJ9CYKvc4qpUsVGzra5V7A8Pp65sDxQNjMlj/YG989ZfeVVPGfTA3qyPFbXBgTzyLB0omtWKVX2UxQcs/thM84nZFz5QmQcXCiqcjpYQMTVB41LG6yYUqwJQGTGJ8dJoOJAlJLNONrk3fUS+DzKI9C2SUXJoRxsQ+7BARBZorTJMRqZvCCu5pVEzCcSBlHu79i9SQBEIJkqldKbrRGNBlGEBksiEUptnYQxArVTm52ARnVjNyUTDqUmaGe55bRinsT2826Z6fes3DM+ZZTMzL4c2P8o2UmSLC2Pczkc0BZbmuqPqvoz06CW1VV6RmWXfmaqRcBQ4QnxxFKlK3dJSqsgGQFiAMFghwAhiVpiSRlDoKAkT8y40yip/TGggwVAcMQOWxanNR1VVwh0Aqiu1+4AjUpmGyUz1rvg5oLZiSF5CJzrRPIZyvKZfPTl0zYHQwWlRCRrx3Pj9IY2XsHYsWFlDKikknRwPQHwYpD4trzM6QDx5cb0SKnSksN19TpapXnECiplCTL0bgAzysRdTk2IzLEZRIkbuNwhU6gWnRQPrcKKk+12pADCUgPsYcZRfU7hbgmKwUOLA2EMhLnm8ZGCTVhj0gSFzZMlDYQyjjpcDIkGQExBUlDxvouiSKeRBqB7rrK4ZNkZSW+b/T3g5NQ6BcDTI0si7l06hFuerHndEMjfHggpGT6aL8K3zpM1m+hn5E3C8ixt6Zz6Stsqz8yp5zOqpSPysZNRGZU3hClVrLm1NM4R6oGzsYOiuQPJAtKFFlTIXMYWVo+9VhuEIiRBBZDKbcIYBSwziAF4yY4bzTOKExcsuGSrgxwMLIqQCcyxgYXCKwwEuKggo5MyEvy2jJEQK6mlNERTELeK6pXqiF//vSZMuAt0N+R+NMNdJvTliAGANiX6n5GWy9M4nhPGHUUw5pnQ9LMStNx6j1Kd7Sr2VlcmkyySQHhfke4n1dmeNUOzgrEThpQpVJ9OqNvVqlYLI1Tl+W2dnZGpkZmtkRDBHxCTkahGbGaEoPI+gNLpdD6OFVtI8EBtVIlQB16ohIyiNYMxQWECRuJxldAjFLFxSRqgqqIEJ1LkL4wsLpD1EJETUUGkLiMMN0TlIJCtwpb0nmyMEXcbBBgkHHHdGElB8wZmKyNG4pE6PnTbAjwVLETAoMcQKFDRGTm5xOwNI9j8FwwdOZGpSVDmFVv3Q/cSxv3q6S+zGbU14KQb0/0u9eTizXTuDxSLb23ZkyVSNZbTrqnkbUkHNSa2CC32aH5t0EUYETzhJOkSFUr6tpzliRfYN7l7knc9CD+6yAe+TMju1M5DrBkI22NonK9xgVd4QxPMELF6BOg1UGJqNkQABkBiEyEytoCNHIoZMwUIELZmjiTJgAjVhVLLdshQsCw7rK3MnYIiRfE/HmTRNmKT9TuTehYykghr4vxYGA8U6aqQIFtZPxVPjc0eypN2BVGmOnD2c4CEpl3qj9DTpRTM0rDD2xWJjSPfD7JQOmKnFGpnqjlgJ564CWvNx/Nk7Jw6mPWOHNSiSCUJLik6VGCdhTEmujPlqY90yEfnS2gtFV0p8fJ+dQikbmWh8kRroH89DOUGE6TmMUZ2SpOnB+MYWYSgeLEjFxOPETXj9y1DLKo/LjNZVnjTi2+S0qZJ5chahtSz49rNTnZGbfrAWWGHFzZBUqizFi8/pDJxSAAYASkEASNIy1ttNrL++5+ZiI/vcRet/rr8e97Rd6V7ms5ds67rXds6uUZGwvo2Qnxj/XyoTa7at4J2c3RCvNHXISCalD7grd0Ee9wBGWCRQdROjIwEoJHGaqzLYlxYRYEsSNArvGEIFsMqMTpWEhEWjDihsbccS4tZzXIgAdpQSnzKAweMCAZgwg02MADByYCG1cmEFod0ggMYYgi8jwXrUBgSRPpIlN59jaaimYQPWOu9U1RoSpY2LYSQ4QpBcDgEzSCNPlDzoSaNFcGKhqmM9SPID0+1Yil8eleI04CdnGnKI1KH7/+9Jk9IEYF35GWy9kcnnvuHsYQ+hkEf0VDT2Wwjy+YYAgmVErGBhYy7l7LSdeEhwcG4YhOJNaD+VC6VA7Kg/iGcn5MHWFQaigSjA0NyQrfJ6MdDtMIohmAlDutRXOIFo8GxBODpYJqYttvNF8RzQieJZMOT0tnA7oZwXg9DEmjmWD9eTitQfBsTS2V3yinOxEIqshvLCE+RhCLtSYjMS0pCNW+uiaBIuHgiBySSsHcLyN18q+K0LlpqB8vG0rFK86LS94dzyNMpXFto/aKhqkeEmNtBLZVVXFQdiWOkE+VpDO7UEQeaEyfrIXqM1iBuWQeS7MuYL1KYWVbQA3KMmoRl5MQ09DlpeueTIVh0AgAQMLNW7ba8nS+5CHa3zzZ0N/n/cXL1SjX3xNTlYeXJlNv0syafX+NiGXrJ291W+MYEGWVkVFTlIFvll+z4QIshiblnbNapNIg8M7+39m2IMJ6+En/XyFAepxuuytNIaCpzQHIatoRsm8WHMlgYsiZzQJQCxYWYBQRhDi0IGWBT5rqGSyaTJlndaSLAjLwtyYY7DwIUpkpYoAxhWyVS5hkAsAU3WDaU2kGKDs2iEveS+kWlW/rqtlYeXbUrmX+mnsaexBFBwGzM0sKDqZuI+rd2Lrzft2l2KCXdJ4EwPhGIasvShjnYkGBwePpCYTAkWMxmZfKDjtTNHrBorQyerENWcq1p/ATULUTy2qZIwifQx3O6wpUNXdhizmroUzjjFfXrLdiGfttUUTBBeKYW2Ck5WJdn684so3Gn2ihZtW72foYSSw1+h3gF1JDUajDITYzSM0dcv8YfKBWpQtxxJHTiUj+J5t1k+BCdOkzoe4X0+gXjRusYhMTi07d3J7hnkwy3aSrPH/CDrJk0coLKNhog2y0GOdM9dn52Z32NN14kEwZqHFnc6OEdYIIeuHo2ZQJnz55kf2UsjmELtBMXq4QxELfsTpkD2LSWqeH/YEiQBf8HDeeS/3y8k8eoyqAAAcCGEqYFD5AQYIRpwCphNyYij2GAwW/BUT8JVFBCW6dIQOJWNNUFdtDS2u9P9p40KXJQ7oDC2rcmJKduU97O2RN1oBGC7wYEgSh9AT1bjuq2qqqHI/A//70mTuAHgafshbLDfAfq/YoAzDuiKR9xsMvT5J9rtjoDSPmUStPLZeWDxEBBCcr0umyB4C2zKF0PUzZr02xFQFVVPlkpyQZjLFiJyXcko3TmPJ9gzjKJcPoyiWsq+nEONJTztDEtrqqrQmKn1CyIsURTCpGLQRmaWaNCYmIhGSoS0CZrDwEss2ymJTpglcKcjqpECxKKTCKjQmKTHyy7DKNEWFRIhZIRQTNGxpxgP/okS3iMFkfPiAdIEJVfSjTDeMKkaqMUoEKpoQozg3jTRNiBhoUZI+K007ZXga0kMh08ILb1vnznkZ9KQ0Ow0OfzliPlL6vxrnUh5VD3GZRh2ggnAcI0kZIbKN+Bdq9kpakHuR6k7r1jGTqU0d/Uzd5HPd410th1IXXlceDQJlme8rxEdnV6UMLsh5Af4MWdYvenmU0QzETUcWY3jUe2B5EMcr5eSe9HKIzaB9XC95AAAMsJQhIc56ggRHA3IQJCZAgCUM4kIDCqQ8aXbV0xZFFIpYeWs3l6VKtqgTX12pwLQWm1ZpaZjtPc3GCVKS5TwtMXlaTNg1ZMCJopqp8uamCHAs7bZxmyQEyGHYq+iardn4oZ93lNmnvzAD3s3gR63NZEp5bSGT1SUOFCkiGA1PluYLIh0O0dyiyvLIqZTGJw6dnsSQnHLlA8fzVk1C0DdCXD2WTliEnNrENk44sTyyY0aW7SBs1SNxuWCayJtVAR6REkDLYpJVYrmJKJMrMQlaPxQmbNDSGtIxBnGUzm00hPiJ6lq03pOlEFw2TDb8ZMqQiiuLKIwZSbL5rDtCtVCCjEUhwhXZjO13RtLOrIqxrJTs2vEdf0TRmX/tZM7o8kgRPULDYEGJFCQ25WxlgtpGui/1JImYRQOwgE5kvqv6hF8+S975NVpstOuUiWyeHlkVILt47dJpS12Y29xW1tN9jcNqZdSJWbm69TicbTu3R0QuPmXrnf4ynzL2afPVTsdkCkcBuMoAAtJd0qDgY+hCLDgivh6MJOBojeNRRNwRMTRTDADFwMBxBzkGAQBukzI0JmdhLB6zyIAZIn5LydmgTwQ8HPAGKfqEkLP4OQzSQpA3RbxthhjbOhXhq1I6Q9VFeXwk//vSZPQDCAJ+RkMsT5CGz3joCSbgYln9GpWHgAIkviOihmABEIY4h5fEuPgt6sLgkUeTQgYj6CGenDxkjohWn+hbXMqE/HOhwTLYdbOdCJkOQrGNnqjjkQiP3zGzqPEqjh7VioUbXHhKDvD8gH+4WfacGeRgePH7yJeO672FRX6o5ukY4zxIceNaVwVDK/h6R7Or1ZNGa4cRIP3NiYaMk+nzxHx48LVF5s0ThWtcBTzx49Y7DtT08F0o3y27rFu1OT+MtPHJsixmez/cjjqE42jx2lhfZKERAAECmHIWZr99Lxm3+Xf75vf98N/s3+7O+eazO7PrZDa7Xf26OWs9aQgZzFAPVmuIT7KLFKZMgRbdTs8LURN29QvYJpkc+zFeGh2dG+ZEItloHuzMzU0RF9p2nuXdqjGYz55+ZuzHsb6yDtLi8upY+itmO3/bSXZ3O367eH912c3fm237Jd4RAwAAAAMbgAxkFzFgNMrDcxk7DL/LMNksw8WTJIvMEAU97XTbbpHCCQgkAFIwgKDopRM0FsOJ5gMPpJGCTCfubRvuphYAAIgmOQEZVDZnADGLAobdLJkkhGHmWtMVDxkoZITzEQVMDisOCcDHOUKbBIZkoRmczaHBkhCIVBwJJJgQlGHASnci2BhaRBA2WGzDw6MPgs1yPQcqBIIGPgMYIF5gUMhhqbEYRAAED7SQsBgCFwwLGKxecLLJlw4AoMlZTHRQvcLBYrAbgIuioMQ3SbQGGBQgj0mAxkWC5dIxGDzAYYMRCImLJEOzEAUfYAgkaDzVUcIypjG0aCUDAwAA4CMpXchZGYMVRDigDgcYmCBkgYJEFyEUgYBi5D+2UO9OX4aQ77CVTJxJrocV9LKQXa0y5FdRZgiHOAFMnAiaiiaYNAocB0iGWMsEQArOQthVNyUknHZAuUvk2NYJt0RbbQ3XaSl8oUq5YVwmIrPUJW3EEckr0rVan7dd1YDZ+zZ7HZg1grwpyNZQkPKXzZI4I0AFh3ZhSIC3FTsJVjWAVW////////XmsGk06ToNwZo0dZcRpWkU6ZkCxP///////+FMkfddTSpHCWxLVb1U8CT7E2oMBABAAADAgARtMJSoEE22MOD/+9Jk8oAOpopDLnOAAMhRKMjGPAB60hkrWd4AAWAVpw8MMABlP5Ihjvv5uqInrm7/CkQpfxj5+fwNNIoedf+Pin9IWWB1O8pD9GBBWrNpqzmfTfZODfZlK5Pj+J2rV9bjQImVOoFA4MmLEqP5TKpEoiJaI1K54+knvmPEa0/OxseL/EDKubmZz7y8u/SR9B29g/7tG3i2a0xpmfe9vGvTwcYtmHvGcfXrq2t+v+Z8fdvrFP8W/hRYltTyy6zG8H/////+L7Ztjf9L11r4//////rAZPJFn1r5xWIgAAAgAgIAAIBAgMjMqS9NFbFM6ARN/VaMrSGMRg2OqzfN9RhMkFtMpxrMSRWSBNiEkM90LM5BmAgEmIAngQDRGrzUxhMVjswGaDD4YMTAM2OPTUpsNaCEOchmAQjA7ScQiMCD0yihDl6yNhJ83KJzR5JMhGsyuSzYDYMdhEwcITBBFBx3DiQarMZn4+GFRMZZNJh4sGAgOZ9DZiRMs7MJCAyCCDAA5MLhUHFUxYUjDQkMvjEy0QjJRAMBgEz8ZjQxdYkYNJ5j0ZGQhiYdCxgcJGCAm2Yw2EBUCmOBgYyJBMNDFYtMCC0Ch4kBY6WAKEjCYCMACswSCgAJVMEwBoEg4BoSR4BMGhQ0ZRgPAIQgJCmEQIY0CSmI8FwwIRwMHBhsjmBhGYaB5ggPpJBwhZW7ReAGARHNTRsD/zDqgAAAkDhAPL4ueYGBAQJgUAGmoohgLWSzB/Yy2Fejsv9BlajZm78MUlPIpVGIKkERQAJFkQCRwUeUfZMPANYjtlABfdK990qEKFcvIuxACpc7MdbvBSj7TmCvDF5FHMrEsp4EmpTRSuvKHsnqWKxvKXUsbu3vllH21RT////////96W54Y4U8p5cuZ47yy////////vzHf/6uc0GAAAAAAGnaNA4Bq48fdVyFjHb5PmTspW0kc6YNlS5GdSWQyq3M+Yg6RBxIgzcBBD6J0riEkhwSeBEFAI7MAqChqGbMoBKLzq4bQ9VCefjAR272f/pR/X4spRAAAA5lSCYWLhyCaXBEQGCEshHwoamHNpo6oYMWiIFMgGzHg0FHgGLjHCcaTB90wDkFxAUUPIcCzf/70mQchijyaMm3byAAWSSJiuCMACLJzSCtYTkBYxRk3DEayJrrhUg1TTCOC4yygvkdsIT4bY4w0hAZioGNjBuIixBGaOdndeIBCYoqooZjRKqzarmCLQw0FeoyTY8aXUGTxACWkVIrdKBIUaGXYBvVQLlGFBJogWVcWB2roNLFVnUqGRHvch93mb5gCTrBZC46NrFW1d1/nEX6o0nE+j+tkSRRWQjcaFwBKmfPhMdblHrsmprVa/VjUdf7J+oply/yRy2mvw9Frklq8oIrQxaV2N2sJ23S2sIpELV2mz+5LLcelcbilWpPZTM1TPpyHMJmV8iL4TV2FXbkPT1+rEev12LwzljQSalAgAAAAAKVDISmYSOwo3GhHFQCCilgoBoIGMPYYSEKJlUjqD5CISsYKtyAASCg4XCACBpj6YwIlHzKBKLjnoHrc5uY0bouOWh7loYWeUFnibinFUyajyChMiWE5fo5Yc+IQxzcww06REOem1iAVoYEoAq5kj4EFChw2p4UGgYwYEYYIm0gzIQu8BQgQbMOkLlEgQGhxpgkNE6ZewCSPIUA2lCIgDhxCKDpY8hFgQVFI9rSbgvpDd9WINYkiaSfhEM6iDvgIQhgMyDABKEonrTRLSpykURAB70AzUFtF/DOpjTIRGtBtENciCZ+bbN3BeJmslZ0u6EpgOA+kxMQO+LWoYljbNUibY0IpSwyQWKVrrTYEicndoVBYiRjSxOHWEyY0iCtYKYVYVmdPrFCU0JaUqxlEIEbIpEk5aqviC1z6IoDuhQVFbRL9U8QkCRooJmVl7JEM3oCcE1BObYJhkSFBSASmM///////8IIHdawuEQCOBDHUhKsGDG/syfGpFxhKl0BE6m1QIbDCW7IYng1skfau84RMJBTxdkqJFnmip1qjxZA04WNME/DuCNQMnREIHQcapheBDZh4aFp0OiIXSK8/E32ZsSqZk1AABvOZRN86KkoCIwj2b82dzYHfDMFTkSjPKDFAjKAwGmEo5YWfOmpoJ+W7BVQAgKSADlekoDWcqmMAlFANILqErgiKGiYKH6200x4IEOYulsQpUsknKWxYCo4WWuJxo3DSkeXZZqBQA9wYYOFLxII//vSZDkCCcR6R8tYe3JcL4jhGEWmKH31Fg5h8wFEAqUoEYwIVAVlARmyBGhEgxRDS4ocAxE3AzCrGKA0HKT8sBikJJqM4GCWh0HS0liKcm7WfpQkpGKcJYRZSaEEXZoCYmOP4MklpLXghSuSp3vmssI/cqk+SQnIb0B2fxPy2ncl1tFv04sptRqZWq2AxHi8T5qKhsOZMHIfpDU8yFsbFciCeF3PaGaRlLqzA4k6NA7EciG5hgQW5FLpnNyEjGVIlsUJol7nZk8tlhUCBepA6bmyaTlCVv//prN/iBE/wjXzb////0t+4Izo+ANPqC04mzG3NZ3xZ6bHYWYGGctCr8igYCJoR/wQHoGQxqMIZikgUKGiZCqEg8HhZyN5G5BWlBbQZUp/v9Nu8r6bIisRk+/9tlZv39Len7cnl+iE/8jKf///+om5pMeGNB8Z3oprTKGroiF/cYEsphiDGBZybhVZpgsGTEaYQA4wJjC4XMEipkZfsxSPDKI+MejwxqEgqBjEgxMQDMMGLzAwoUiOFR7MOAFYyiJiloQCJeyRJUiAMmpZkSAwmGhqCvlM52kiWaKeSKMoFqJCOkXBMWQW1bxjUOqUVGlN3dY2TTQKrHMW0uhuiIFIBpE3FtUQVwXyZIYEGXZPB1E0JOUdihQo8hXR+CSgHRlk9JQcatE1bzyF3CdJG2qU5YUE7XqNOpNsyesnlhwfqBcMSKRyuMVNLZ8LtVuEdFPjoRuj8dodDTLKollycWxtjsK0mWNhclSw5fO0xy6wUtdQKKaMunBgVy1M+esj9GIWa7Vh5dHx1cxohPSplphrh8xX3AXG3NUSuHyaaxqlGMsS0z3Kn5ze95Ycc6lD5U8r0PcwCaAIIJTUcWEVQaB3ALlrFGFwEIRj3DwKoKh4m4Kwa0FWzz56dXPIsWKWG3CQsWQytd7xIiREwfTXq3O3fSEVAghQ8IILEmqbBKXdsDxL/+HaP8Qzs8Y1TBPIGDHYk0x4MJbjA38x4eNOMjKmMzwPAISyEwcaQ/MWFRkFQlFAQeJW8EEA016GgIZ9W0MYFNEk4FUYSgAAVxGwCpSEAOWYBo0ITRC5V7JkfEshZC0YMVIJfLARK63UEpX/+9JkNAP6vH7Dg3h78lyuyLAkYk4mYf0TDT2VgZs4YoBRinkIl0mqRPES0BRUC0Bv1AVPs2YyXUU2UoXi1cuKXMUUQbBSaJHGwmw/oARwlhjDsFtUgsCaQkLYdQ/SZDHEMG4PMF+qTncCdqkD7AVJ1qlKIk3iE5TVk6b50m6PA6UKUrIXM6nSKOY3y9MCwZJukBKRXk2LykENWHxzF+GA3KAhipLc4HSuYauSxnocXAoDOL4jl4hJVoMeAuez/UDMYhynSpxaVs5UohiHl/VyAUBTPR60MjqOYlaUIgTaO0LMdRqFbFmRBToUX051Qdh4F/Mgn9i5KOCpENfrCIXR3qwu6wm08jVtI7S2kgTUm7hBtDJUAhMTEUCVJirbDz4BCgzUKYVS3Zv7bs08Mw1VZ6qVsqGekqMGj9KrhhqsSgzuKZKJ/Bjf2uhlLR6wiVKdSyJ39f+tf+taZxP7t/vIf0ro3RClCjaVb2EZBz/pC4CjgG5rGciGzdmXDmEJGnfAlAZMgZVEEUTIoFngUCiAQkwQLViIgiNjSHiYPAKlrLyYErW7ZELV02ACdJSB3IkQcEeDbGuQ4FsQonQWZwCfCfGGPgnSJOsfQ0WaCMoIYHMSE8QdIUoGmUwmJhhwkpQ0fTII8LaRgnw9ccIcLMfBOF0YCMU5m1VhQHw9T7Eb5LCTEwYFyrHxktaML61O18eDC1GA2nSysC+X4d0BUJpBSl85eQlQ+h2mkuoIkmhXJ7iskoi4LCSdn4PD6YHS4SRiJuPoieuTn7poVx1EwKyRcSCQduHRTUB+DeMjLhCHcsrTcOQrsSynASYW2zCEPT4cyQUFSGXB4GtWfqSwOClbCFxKHwsuD6fnNUNkeB9MbEkejotpCW6tE8pCtOrWoGGJaZsAynRxiGMK+XqhFKzTUIeN7yiR/MzJyI6/svE2xgjwph1Vvp8fCJLfzY8EmICmWpGTaypJRGlmzWR281CVRndLES//6rZWG/UhlbkarqvT8iGbSyviUu5akQ7sQHzirFELtxzFgNA3ALcAAGanKoW3coGRm8UZ0w9dZORcvKIEEjQuGxhL9k6l6iDZWFOnF1fOylvpY7bx59jfTIpJ9oSD9f/70mQdAzi6f0VDL2VAZE6ItQwjbmYl9xENYeuJXa+jICCOuUBsnsiS4kpNptGDKgy5bQJMzodEGKNOlohpEQC8DdJqLcXNOHcyGEuh3lEwHajQnnyFIxjopICYkl8sCWTV5WPlwzDKAMDteiHoGQIGA9Kh5StwrPViQuE4ijiTBBB1coToRiFCoczMxMWmy2clBHTSeRDgsBKTj8nJDJ9CPxIgoIhkfnrR4WUg6j6QR7MFTEgcQ3kJFhkbl0dSzsIsN9iKxMqiEUsmxDLJ4TVArOBe6ytJJUuU3i+gx2wsJiAfFLy+XTlZpIiJiouGBeEcu+jIJ8fIkyi5gTR0XmrVweAAKYg1RDP58Xh3fluZAnL+p0dJGpGY9zwbUO8hJ46/EGL7xCThdJol9J3myXKdTf8i8k33d9JkeaKi7oWTFTH9xblwEDP55XJz3Pyr+gSu/UsS2pTnkmX8KTDn45I7UEOocPBBkAdhGLCCR8HnDJJBY4Y50DrwdRX0NY2QmuAOIFBovF4RCpDkLHW2yhP9LhDRAEoco0qFlEkEQmdTcqJAgoq9k6qzrpDipWZKrjWNq5vnW/a1Qjgj4UARsNdTH+QQlotRuCOIQuj8OEYo6kHGNk1i3jdIOxKl2Ui4TSvEmWi1ZsohOD1QycQC2ppvOF0Pk+h2qM6TQQMJdtsEj35vKN+r1UkHsjEzqRdP0kWSGtZlluONTrVGlDkSryfGk9JI5TWRsqMXMI6YCoRCr565KBGqdkmQlP0PY7zLUDSvMKeSyybhPnFWqcdGkgq0UuF5Xn4QW6kR8riVSK0hDkOA+k4hDEucEwUhbEspErst6fOtsO6x3nk3uZyGHAMLR3IQiDw0TyKmEue51q9/AKOAczm3MCEg6JUFmfKiV39ey/bNf+v6M32F9IihQSzpYn/CmZJKZZYqJzChRc1xfMMBVP8jP8iLyalm7D9O2r8ZVM42wauNlVdDRP8mShLfK2RYNLqnTI2ObGsiWAALAAAxSJMQQhAEBBwY0FlCQY0YFgUEDi4AJcPYLrkXTGMKjTnGIqTqzj2NNfqNuonzADzOvDjc5E9bWkTRpYnpdlsTI2wjSQG2PYIyojcUx3KE6D3O//vSZCsDObR/REN4efBZzki4BGLUJYX9EQ1l4YGOuyHgkYgwxCR3G+QpCydjkLskxFi9JI6nSTE4HgbZLSflwJatIYpSfDAPwmzAbowzxPRssXsy4iXQ9DVKvmId5dHqgPWAbaI1goUNPDTokBLlEyshTHonC4vlJh+WSSMiiFEv64hsUM7EUSmUuCuXlce8i6MJlK4gRcjrWl2koDtmPnSXVp/DvMNgRiiPNcJ5XJYz2tRphDR+qY9Xh+2VahZjGLEiI5AUXGNNdMLJpsXTQsFgUJKoqytJgnZbECqnJQJxcPz3b0cuzmPJUIUpVP04hC7OYfZRqpmO1SrpphtiWaGNVsdwAWAABgICSA4u5j8ujoxRz3mRNlyzcpbNbDJvWogdcZi5w0ef2R/fRlv1Lr5mdtWoukZ+iPmMfem61MDSb1zPfLZ63VGr+5mMCqqdTbU4k6//GOHnGCoXh3tEalA4XQVMnxgDUBrwCIA1cGvmKkYEhkAjDJasIAFrQAGXrKLEgHIBVMslqdCIJaMwlRCyzHCAalhhBjI4WJCy2E7GGc5pOZHP06iD+UzeY5fybmmknw0TqDSL0n4qyZAm6bKq5MR6w7yetaQLebyiP+RPJcvqEISPd6ZpPkMSpeUJUSrsZa+SM81crFhxV5jL8JI9VmBKokVOS0+kafqthneyF8PBdXgIYl2uMlUIYFWl0QciJeUW2+p6I05oavRKHp9sy1KGOb5jscY0UowSqCG7Rx3tjeslMQlxQ9fXkoqVen2I7DeMRgmT54IUinBIGsWsAuRapZ65oe7hqI8fBMk9B9l+hsLGlFmAbiGtzap6m0elFxRApBTQavlIcyrLAcLCqicYXpD2i2dAAQoMaIQsHbDYpJo7NL8rblhtW6FVuhPeUSMqrpR3cOYeqqkhqXohK3Ul7G8qmb/onQxXoZ+z+yrbog6qrL/XhjbuCQ87sM2kc5ZAAQqwZjEILYYrtVnXY6s1J+ju/KLFDU7pJSdjYJmcg4sM7DxhHgFzDaCCPjYPJijaTdNxgQmls/aXQANHhYm8EamZx23DRCiFiT70lIt5xYFvPaJIOBWDCel9UMOJAoh8isU5an4TVbghFQpjqkH/+9BkKwOIK39Foy9ksGRPeIkMQ75h5f0WjT2RQXo9IgQgj8rMEQqNzEpFserkZaHpbQ1xFHEno0vDW+VBNKSWtT0sJboJVKx/Ga4vPomanBeoU3EZ7CW1SJ5k6PT6N9xESD1v4DlD4tKxOqsfM5Tlw0V4gQE3VbJlBCQbLD18SalQ1ZdQiwWWEIsD4YJzJS8rfLZfMIvHHCy1QslY9PzdMsdH1OSyMEKVcjdZUqz99GK0SRCPh8J3taJq0soDB8VVh8QBLO2Lw3MD3Sk0pODw5Jp14ACwQACAsSp7N2nzbbrI/g/Kqnsd0kan9Cn/ZgKbSWUY0juojT+yZicb/Yr/fuf7g6F+vzkYnu9Eu7/9aLYwMoxshJDVVcvwtJ7wUDMKlRBnR1qzHhqsMzEFLKqymVhpFoKMyHhxROMA2AMxwsefi5oyygxComkl/TDEAQDIBYOVgoGIwA8YSqU3JQRggyRo0SRthn8kCcpVIg3TnTpdTKMlGMh5HA/J+rF4+lcq4g8k8QRGHQh7Qh6VPhZTzOQFHszOrzmnVL0DykxHIpIh+NikdwFosEleX40R6bFIqLUxy+SKWMl5ddL8JWjPR9HVUbL0IsxRqUFWTHZLaY3hHdonunDx2iRF4hPfRChRuJ1p3LB2wSaM2VnJwJNdRF9myRKSi+QhIdXuJ2SRYT/ZE2IRCUXyi2fOEq7yVeqhIg1qmC++U3zdg5EspiOsO1yNSoK1hIKIwXIRVfsd4tbXEc2PTYktmDaqMrlZY8sMTBWP6pluABYUOa9te2mcr+5z53q27aMsu1N5Gpt0dLaeYcgPmNRs2rV/I3r/PUFZcWZ7kSiHshtGNiDwPDSroJuciEZZMNkQU/5f9/uZ8wbHpyvzB2/j1JRv4h8hhy/n/4i0iVUCyOpk4AnnLDJj3KAUIDFRWOY4GNBMtjCpkyrjBISCzF1lxLsSpYWpgHSguKQrJ4tOy4QqEptIHByHQkEvCSoE4cWuK2iUfuFQStJelQSA/aRsbyMsRn5dH/jM8v6qjx8nMHD6FI+sVt3ZElARYrfP1bbt1J+sO3XIM/0bsaI6lla8dRwrz/n62fT3fRIzS7C6zMSJasSXU/Zb6miZ//vSZE6A915/RttYYcBvbwiAGCMaXMn3IW0w1YGwvWIAMQ5JxQXbWgLK8m85AkaOT9669Cb9chHUOJH6Xk3bjOTx+I7d9qFslICp2FCbO4Y1ECo7u2hNFV1MfJT6GGJaysodJVh3AfroWltIW4lCs8UtUDkF9zyLhY3m8TVWMlRHj1jNSlq1wTZkXImqJFKmqm2jqqGZEpynoUczZgfkZnmZGnCufZbym0uxsRXla1sjJahnPOkOd5NiXNCBq08sIx8P2vNfHSQwpGxZwz45+edIHBnklBqqE5MKInMXX9jzyDl10tK844jYoVUplED6m4BgBGJHDVlTLHgaUUPBosAgBQQ6j8l0U9hgIFAyhj+tfXW1J2JVOPWpuUTgIB6YBMB5HQRDA+Sy2Xi2ncHsJwPk/CiXCSPBgAgQACCwyXndjo8JhYJIFxQJAcBIARAIBIUUjXMQMoqMIKxhQJChiBAdPH15VHQSFmxuH9HoFs2X6CEKNmVI+cDFpjITSIln4LTkaBH0WYgZpQKEgaeGfmppIPJxZvwofOo6kT1OXcjOl2xpsvrmoIKMNrplqgupmILmwLy+oi50s840uJO4VD3kiCbuXpZ94sdZVvY8OZdQAAK+FuvCInRBEnofuNILYom98nr/iBAgwej0bE11PzN8+hxaCJ12+uyF03Yu2T5Rj/k/K1/OR35JDoLqEWhHD5k3/p/uZfkvxFf8mhTrm56E70iJCNFrpqVoeUmsBPl5AyZqRZI4pAZSrqnMiNmGoIgQJSltD2qPoZ2YKBZZQcMTFggUcq4s0vZrrDVitWXalSxGfC4pecoiMo9JZDEqfQEEXNEghnZyhJAqAgYQ9OK9eGkwIcQQ9BM1y6OahCzGcybjcJEScuiBLnBLaTsKuag7jERSXFfHqOQ2lCu4rEaKLNwxEqh4saO7+CvKxvLC8FQmCEAOZIyXmgnjQZWg5VGe6qeN7CrFTLlyzCfwokO7LLjc+tz0iah5RIPtcvYAKcYUWtEoJPrNNQmdLz9jJTDJ7i5vDrWR/fM73LM5EfUDZXip/mjWzV2+sW7W3S6bp28mOEcE+wL5IqnuFBfxKuh5m57u8IzKmaa5iISnA5kDDvH/+9Jkh4Anm3nJ4y81cm4u+MAMIygc4fcpjLB7ia4+I+QzC1gCBxAlqLaJKxrmHdnagboHNwdDhwVHF42aT5tDOwZUc/yX/X/zeTS59KnL+5fsaupt8POXPOfm3NqZnSqH04/2ZB0RYv/bCz/Nw4czy7TCF30B/Xb+xIgANR8EA0UuwGqEJRi9GlCKShjJlEFQUIOHEA4FQUvSKAs5Z82NgsEwK3V1l0wTDNlgztw8oPDUCOTbo2+qM3gqOQa/jLWzQcyFWhzXQo2gQ7ELhIGgTB9pETjwsLCEZGh2Op0jMjg6VCQFQXD2yvPymy2XVqjy/Wq9w7tCy+uquMH+LNsOi8uHsdTFJrRndDXtc0uW4jjd9z2TSyRNrUcOmK68NGT68LlmFkCZuNHzfLVjq2pymZxbT+bojo05d13Mc91ls3vc7rD1Yn0afgXmHINE9VdvCA3h58cnP1ZPhYUw8JWQAJPyn0pnrspaT95vdWasEHOk3KnU0o6b+lbU8lJuybJ7TOZ0S2HFxvh91NN1Rn15aH/c62mK2Cm9XHUqJuq2VexavbeWcKZSGd6O5lVUXIYZyIq9v0N7M19aVmZnG+nj/kQ+N/I8lBKLdc9riAADKiwYxucEQENRIsKrwaEM2YFgxpRYjRAwIY4S0dfKLycCANOtUJf5Eduq34OnppTFoE88MDNJcVo6qMUfuUyeWSt2lA35npVFokypqTpJzTEzK5U6TrQ/Yh6NP6/sRbqQh7DgicaRrYNSICFYmZOLskCEEU1kSIdULDXNgQuOgbbG0x9wMrIThJJsnNK4sXRlUYhSbnEuTJJkP7ZZyJE4VCi0l88XBbwC/ROCWmY2DDqWjh4shdPkAjBgMSOZSC2soknulH9A9kRW4Yeni0ou58QRd7lrfPsQU8E+m2Ua+kYy2UwBmEAAI6nEbLBAvcjg3hA1NSEZ8NkFIWW3bdNnO9ZkvVI8wt8lRaQq8/BFwoDrFqz8vNpVyIsqHN0fSvaj2R193slFtZd2fRbJYm9nTJR92drZVut5N11uU+07ZUIqZ3R35AbG6Mtu1ZQg1KbRQ8EKxGCWcp5zRmWsYToVXNxQAIJ2mmoZCpoIAY8OWJAQlo8lGf/70mS9gDdHfsljSTcwZO+I6ARinl1t9SWVl4AJrr0jFoQwAQQkB9sCNIUozjPRONTYopXM/iFGGVS8zIcdbqWyGpptgbanrLRR7X6qhlTzO8i7ctqCNFZkqynUxrpiU6iUKmw0qxokhJ5WtjinDTYlezwsR0/hXx9N8NnliR1wq2eH5WZ/eeA9isutXfOdnzxzgameay3UjQPjxn0TeNSvcXjUfWtWrf4tn0Cd3Xe49aTT5bqWxGv/NHzPFf+7VPCxZkYKXw/rGn1vMLOPiZ3rO7Z+vL948DFd2veuqXi478amBFCGtW1mXXl7bBcWRVHCogQOgJ0YLVwEaxguLgUQ5CB2dGLwTmpN61FPmSQ9IUO08ipzysKX/8j/W0887/+ZHDypz1P5/4b7x4bIbZEVhfeHz/+P6Hc0SFt+f3qYIvr+EB9KFwKe6wK9/M2gEDQdDsdi4WiwWCUJow/QKTCzC3MCMH0wAgdjBYE/MrEW8wEQADAzAPMCwFQLgBGMiLCaxSHgOCLBIAQ0DOFQXTMqKMMfAOQSCQSEsCA4DgwM4SQNdG+MGA1S3MMQqHAPowUCpuEdx0O55nyD6VZfoGg0tRKkeCsYANFYxcDIzrOUzdJEeGdfC71cIIy+ql6HhgAA6EJYAIyHJEx7EUwlAUxMAAxHH0FAUtIGAM3IoBZHIgAMIBWkawSgKrCY/h+YKj6ZRj6JCWZunWZukGX/X1LFUFcpdMDSQVXQDRltJAwQaEsx/IUx3FEw1A0wIBkwtBVXy014r+qQI2JjczEHilDTGaLpXk12FQowMBAmAkwPAcOEgwFBMwTAEgAMOAd3G+e6Zo2sTTcnuaQ5VZLV9m4Lso16pgNDgKDXFMEAQMCACaaEAYDQNBQLp3pdsQSDTkpa0NTN2/9y/coa1fcqjVNLKGUajMSrzmMAyaWwEHAImQXQlIAAIBAAhQrEXIfgAAEngoOJAAyuxjT3q97e8K1bPHdSm////////1jc1rOrrdjuseXbP///////8jXY6ksbguibZI5F6Mtbi+TSG0AAQMEQQAAi9d/3qKo4Cr1P0kYL3nIJWwkdIlQuiw9CiOMHRWgShIGoUoF2DbPazc8X3GHH//vSZPsADgyKSe57oACyELjYzLQAYjGjSb2cAAEXkyerhiAAuF4Z66Rxi4boD0EbIQ8QWt6rqdJBFigJ2DmJAeAng4H1VWL7qvE4B3kmBnhYDWJ260vevQPKXTKjUcZfMTEhnipT12+xgaHDSgdN8ZaRLlSyetElEi42jW7eucaZvom6XqRQUYHHQMDDqoH0f79H//1Glbziv//5gUDGsswYQCAAAAADNuOngW4kUALZyNnFedUpsDmMSY5yxgKcY4wVGAIABCMcBTJCSvFMVHFd7iRZWtaCiiEtIl3lpuattWGWJoIXumRFLjoCXZWKogpYlE9aNDWkxWk1WatFTSUxbnEqdNh6oblLxLZWKzxZKar1L7c9wnVjMNPu4sqqrqcJ+Z13nrS9ZQyNdT4rFaomFJXsfqHlzSydY6ms6ylKsDFogoMsC0hCUquga8TO17TzSWRJ9QSuVtY+pkxZL2EMSa+8imzAWtNxYLBTEn3dV2mXRyBnRabLL7swdJKKUv7U7KYdfZ/rld/YxA2d6VS6UxmW6qymo5V/K7GeZdlWdJMya13H62WUtrV8dU1/HVWlQgIAAEAPeBgzqpSmpM3NF0VnbK35n+rFPZyt/I0qMqjtiIJQpGxlYLGWxhYNhiAvrq5E7KHsUlzQLCJ6+HQkPlg3NO+InjoKAAAACuEWJuIneKasZgQAUow8UChVA1THwMNMMEKIkB5YEVOpiXGUXRZASUXS9BRkUWugRbIEVwoVBxazqKxJ9hhgsYLFVcgSKpQ4KkIEmmHg6qXaAFRJnCZKE5Lxg9pGNCbDoAEWqgxdLAGHqNsOR1LiK4f5X0sibIH3Wo1VhkrZdZly9GPQS/rMndbLBcNydPl1oVFKDWFI/HdS2VVpHLpIPBJwm0f6JssoBkrIGFo/32kaElgPk3Qv2ddfdOjExPVZ2eDwZ+obPLl5Zp9zevJrM2iR0XErNfGx/Cw7eFplmzt4+Y9uaL2Dt6JY9r0MAAAVbi3qqPtOO1W735H2bOMXL2L/5B0w5v/jP/+X8aBaNBevmthfb+//IcPsPpZ8Cd8+IDdsJy2EvDhHpVMfPyRl4UR4yoM/RSsh2RmEUSQqFnOVWfjV8SD/+9JkpYLHjWhO0zhkcGWIyRI9p/Ce1aMxTL2eAZ0w44i3i1BnKf/7km0539IZ/8qABNALuJIDRyMfM2ATunA2qqpzJgK0wQACVTrRauACUqFEwAO3BsBfpurhNCjDSkpU0qGCFSoauG6CaaVpfVH1MEwgVcK/UBZKvpWVDV5UwnOac01VVnJbpf6FsRWjcWK3ZIZkpc4aGWBUxRRLswwrKy9AKrmIO3LWnV4yaBrEpUhRTp5LHKO4hR//aKZ04Exi+JCh8XFUJCMnUoBaUnDxiUx2ySWfGBmmTDqP3WUlJUdEoVD0h3aKtWfMSxLxuPqGtgqkLyo9LtYDd6w4tReOUb0RyUxbjOEZZdamTJVwVvtLrjtUygTol5iTVi44Jaw+RHKB//59AADDUEAEskjRCY7CTZM+Nif779I2eOkdxiHuv/xsH5OX/4Yr/38J9GbUNceb61LGZtvlEtzHmURNnjn8rBip9NeFG///MdU/yLeLGQxjEb0IY1AIVP+n+yt9HbVKeu/eZb/+p/p4JwCACav6aoQdUAC1Q1uMpMOMjCFpkEhxh5ySYG0GZOtEQZCoR6k6gaUTSSoXOkKj8voVAILFRauS/0Ci1lERk6ojCRB1ZClMCREgShp6bqVqtCEQMOqYAiVlR+XdBwDTAik33LLwEgnAxkn0mmQNUhp0YBc2Ql/kPFh1vouTTRHijCey9loyOegOMsDf52YDaStJOq1AV6QKWslc1vpa7kAyWGJmPvlG8p+BohavSAaJQJ5RycCIsq5gVzgbRE815tU3MyqgUtoqZuDSTGYwlOajaUm71cyeaWbg9ojwgYuaUpFTrCSxc+vOmVHW2ToEczPST//9RJdNd7MP6yf95NV/6aT8iAACBEAC+RYTKJoj00US/bY2t/GtmW521uRe52OJU4b+hn//hTAwC7hgpQRBbBhyCYkTgv/SeVuitVKL11J//ojp/9aJRqufg1viDrAHiZ//qOeQPrAZ+HykQEoCxhYHwXOAz4U82dco6QaE5HlI5SmU3xgI3aV81GPMw5OIzjOUz0RQxPIcxgFgx/A0xoBomKcAhCHAYPCMYeAUYogGChpHgaMEgdTUS8HUTGAC56PAGf/70mTbCogqekgrWEzwWappCSTCTic59x0u5ZPBoDrkaPYUmbdxT7gCIIHVkUhylJosGGAy+wjDf5PN+1hk1nVlCC40Aq0WHZSwJPUEAqdIygZkAhsAVVetUiCNwCQJ31moDEfhwEiFQqT9bRS9uUBPhIU5pQn05kRdWBnaxkDOXsa6/r5NKYi9t1hc3AEMyOK0leC5Q91DZjkpHg8+BBSNKrjEcAbwqcKyGmPI0NLTSqTVTusk7jEpPHikqJ8Q8gjSu2O1R0uMyiXt2JSjKliAiLTQkI1aVJJAE+z+HxOoiOG2DxeTD0WERNNmsmbuSvya6yhltDnEPJk6pEutNFnr7zOM/j9owAEAFy9scCxCYivAiZOYydwe5fRD3j3JxqCo85cn6v++T8peiMMaxLat50X9G8zf9HX2aLUfud+jN8rqYXeVTiMYdDlMhRlaHPQO/uRvqPnYWeG1OJNo2O0b4m/uw2g1MSZj8E9+Ty0AQADSYjaJi+VC3HNLLcwEpDPBeNOlU0Y8TUQ2MErI2iKDMyZMzA8xKKiQXmNB0Y3DgUAg80YcI1m6KAMGQC5gKxiQGKk02ZK8iYvIAVJoQEI6CCaaAgYlSX6LbL9TBCDKrrMjRMJtVvgxJLFHMaoXQYkVomyoUSKHGSfCq0nI31SxCQksjdKC50QS4aSuJQBDq/gDYZgxy8BmhQwjIrwVJPg0iHFhgCfh0th5mQIKfC+Nw8yXn+SBGOIhrCwNRoj0CPHYbyEiWKA6ENRSQMVDTQTgrilJUQtTsxokGU5Gk8TFEkw2dh1GftgH1MtF2L8k1cabdpUQiVmYNdnQ4ka7J8uLrbddqU5u9wXR9FY1HzCYVE/VrIgjWeLs9z9ckGkmd4r24/GV4WCnhwlfhpOxxu8MzXlP+HG2tR8x8/rh1F2tlHmytln8kBzkwAABuDwCxxwcBQB4IxYuf6uq61dM16xbHbFjXarHP75qysTSr0Mo+hZoddXMPOAisW+FGYzU4ZarVH9lfItPVn6tv8v69Ov6b6+5uLkMh6p9x9RdUX8nQ8daoNwYTFOx+haDoaA9yDpEIAzzYwpQ00I1J8BXyVeRQDBjTQDAdAHDYEFmaGOE0oaH//vSZOqCil19xTOYe/Bnr5jiIGK4JBX7Fq1hkcFlPOOkMIvZl92DKBBxZMZC5bDJ0jWICxgcoIKPeRNQycNTJTBAOkA/yVuJIAWnDKREXY8pcvAvMymXsZf5uL+xVO8v+4D6JaIoOuzFMRLWfaIyt5UdGdsPY2QGUzHRLSbm87BrcRYI1FR2BZa8S5Jl5HZZdaZg87tjmCZUqTy+ciMMDgSb+XLiOWj4xiSFgqp305wtHpevdLfQkxEOhbKxwTjlQtaXupkQnKkqW4/nDh0tQrlZzyTESy3VqJCbKRdJD4kw0q8hleFGVHxmyWERXiLUJ2mLZ08Xi0uPDhbD1uufweXyU+nXkkxMzw5jWCuPTJO96g4JBoiVwPLjwoIlSJ7kbyHHgBABmEkO3UTdnUmY/k/h/+tz6UP7//YZ5jvIgsERFnKZQFLxzhQq9kxzmDJ/v/sE/IOYxFktz+/zL50f/waoqJ79TcFVidKvbM72KWZpayoZ9UM+fBOYO4wqAIAgIBo8pUxGeBGTvhCAzKwxN0yMQ7ZQWvmKGJXhGMzQwGg0AbgkwcRHkY1EX/GQokTMGNSSWOwN2VPRZRNccgLlPKMAppxnmdARAFrluaBVSACUU2JhK9lgW/ZpLJ9BsOMlsWWo7KjERAqmUzI627LoiiAsVI5srQUGWjpDMvtokqvPcnJNGEM0W4kouwvh4CHIeUZtpkORTNJqEGN4uDCVMQ/SrPlaSqYhKo3mdzRC2p3FaL3EUiYfHS1RkPS7yOn9MSylIyajMJXHjZKLxPMBcnFLS9ERAOPnYgLTgzMWyqpINlyg6HV2F0iaiFx2aA3P1S43Un2FhDo9CfFM8Domk8hxoKkxSDc0PRSuIIl3UXNHi8elzy+PxbUyDQqFwnhwcJi0Rl9xxO5OR9PF48HBIVC5gAIAAcOiE7R2nJnJgroIM28oZ0mak6XksWmWl9V/DKvrAwMhIOOq/dkXbU1JFo38b9etj/PQcYO3tMvMb51HNlYs0xBQt3q97e5ERP1/Wfz61R7MpTzHc7wqGe8465Cfit6JgBYAMGWjJsAxE0MKDTQCUzwiCFYwYDMcHwxDKD4RiACFgCQEgIYBBUiRT7mFxcr/+9Jk44OJqn3FI09nomMEuLgMIzhoef0RDeHtwWs2olQxiLgMMWtQQtbfkiA1aPAIRQRgBEFCWhMLhPG/DsuCjUpklMvocMmLTF3lTKbRZPVB1fq8WoMkXq77V1HU4X1bcQFfmPiKmCJ8RQhxpwRvFhMFAyJw5CUrAkp+C5UEuLcDmFhHMX5DkoGOf5+Q1QX89zWM+aUd64iqElDIR9kchxYDjSJyn8xs8c/Vwrkcwl6P9QKwsS7fsx1qUmMhYpZB8sCGmGwxlwcxyD7PgxXzUyE9gGYoFl1s/bpc0U6eaiVbMTlRv0aX4/znYkNL5KnlcpjwXnNNkFcUOOSDRJFwummUwJVEgGdFq8/FW2LauWU40oQS+c+GpEnm5mugzNYz+jRkatn0hBBLLpCyrRRwR4xVoe5H9JNFQgFxaBUeiYRzyDGcM4L6y4Wwjv6IzSJx2z6IZOhgLRinFMJcxvVXA+2Cevq/dnVtcFuhWztxz/q6R9V+wwNmT3kuruVs6n7lft+foe7f8+ywZTGlQR0AGgSWpiIAAfDWcN0ZGufqCKyhqWcZCbeIZmGYNMfhHmwB0WwNJR6S6RjSqCaCyAAeWNeYeny1GRs6a8t+YVmKGIgJLLoYMW2XM3cSK06KMDFsJ8HG0DzFjL8T4OY/wYYwxbl0QQny8X0I8AdEuCfICXhJLQAJEedk3N8W2ObCeM4W0h4vi5rgcCCKlUHgTkh0Y6z0LRGF/LiXgyUsSgzISeNLs0RUIYf6lFnZlNGQgsJdD/PVFrb1CEYQsXjMdxVINjUB/rxyFSUOCVK5HI9EQ1eXYnjKvthI04e6EqhF1L0ryTLhFFUe5fTOfqBOLDpKkzgKdPvxeq0kaLHKjzvdXL2aJ0aHKwIwk53Cnk6O1xRD9RkJTaiXmFGFuKAkSE0Q4kbAr12RpUrTiSY8EaoUz5zdH8qDJSYnjA/RZBHFbbIGlSayRdygAAkAAYGrxSvp/VtbfUerRfb8BkE9zgZx4NVndS/8d6zZ5IA/Y3v8/ZFW1/5e3iezQCn3+qm0X/jScFhnMB1Dm/r+8inZLePtZYrf+jquF493/c1DEN9GA3rskbEAJDAYbOcXYecwAGZNONS9MP/70mTYAzoTf0OrWHpwXQAYqAhjAGf5/Q8NYenBbLtioCCKOeqM+yDsAsSAWjcQFpUWSaTPDjIE1lrBP0lW1tuyw7ZE1kQE8VoKwJKM0bEgqpYv2CU4UjkpEdlCRxLqiLLJ/HCPFaPATogx7BfGkC2O4uRCRoj9DDV6UUoixjOJbBZ1wWMhQcAbA4Rb1suBZl6LQdSXEaYxORJnRTlaTk4i5s1RywFaoTodLZuHMijkZjqLu7ZVMZJC1hPOobanFWf5fjfQ0nLSXt6uUKnKw1S5sbOUCtYjeVS+5rsmDov54D5PKdJXOlVKsv6vQ4vagYV8/0Czl2fK05TLMs0jxfIlEnU6hK5CzmU7GyJ9REvLknWsk6MK9rOJALZzOakglxMVG0chxHYVRAGRPt55IauDkKhYLs2spTIpWHIxGOYLzCvSRpoQ6aUIW0uY8JcwD5a53YAjsEEHoarTd665ymc8uXXgR1Al5zbrAGmZeoD3ZMixsKLaEb37v/mdFujbqqMhHd61ozK1zo7O+ujp6bXSlr+5UU0miOxlR6bKfq85WdmRKMV1MiCKkJC7vZkqYB9AADyojLoTYGQhoas2IA5zxhpTSYJkTgc0WZCTC1JlLgkESTtl7xZBnLQEJTd2gpfKZuBIFpu/F6Z52oP8156GUPsu1I4GjvQrpLEFM47RmikCwIktg5EAj2o3hYxiiDmEBKncooYkg5JidjYgm+XkgJJEJLqfCyokWPSyOjLSZhjCVCGK48kLYE07RpZIYh6LhroyTIUZ6KxKPiVItQNjcxsCDJ2upFhFntBLe4H7RxcDFZzhJyyq806qpAHQxPX6APdjYl0X88lc7OZcKRrQZxs7aasI6Vck2fZnG83KY/YqaclOacQ3HBAwjeURlnyxGYwGKwwzfRM54Mjs3WtVn4f6PFwZFpDX6Hk2wuleiEJS0ZJMrpcnKXg/j6RK4RC8iTsJemvIk1McxinnMaDxcsDxRv6AlFAABASGyD2tftZFTp3X0O+WDPncpkHyENbvewoRmVaUl7DkL+lNVGHIopZGcOJZYRZp3XJk7kXTLm55nWalPha9nSc604r+WYMJ9EzEO369bbbm7tsfwy3XIF78//vSZMqDCbt/RENZenBi64i5CCPCaAH7Dw1h6QlsPiKUEI85vtV16/mJWoA0zIzq44qUyBQKITRICU4ShDLqSorBVifSB4pY4oMByLbRXWAgEkGqICWutRRxA8ibiHIML5VLYVCLM0CbCgiAhqDpW0yZRjIyUlB7EwFtJkaY3jmQDYYKtCFFjFATYmJYyAiRH0K6rk6dZb3pzErJKY6jNEtpyRjJM8cxtpdPmQiC8FyM01AtDUp4pknOi0gh59myii8nszvkYeUNFZTNXa4Nl8mzfoXQy0JXCEpIX7k1k9U6QL+bxPUahjsjjIQb09mFfUB3k5QhjULAn1aUK5LYrTfUjErVfFMJaLu2FqfihP5RMSkMxtOEn44FtdIWiIDAX9DDlS7MSdvikYQ6qMNclhqoQaiymY5gLheMc8EozjfOc5zhNxOmycaZLGoBzzF+TxfkIJQcE5IFIiDiLeZaFn/EPlgMpHvoI4TCADnIAEQW9nJk8/lIzsZlZZzBQeij6eaeWeGZ/xQDkGZ388v+7MTNshoNERJGg0MBjTp/HUpykiI0pRmguwzUeryiJbkdJmeRFTakKMuuC0qqWVeuRV1ITCwqCRhJJB5gIYEO/QvKRWn2aYc5ikmFKCDzDTZoo6FAiJMWLUHVvkJbxc6yibicKw8CfHOnDNSC8fp1NROQDYvatUZwG6ci0xnIjR4nshSebmJ2rpIiKJgn0yzKRySSMYcqouDih6aVZ9j8ULIchOD0inm5l/J4PFYVijSDicbGwFuVqyXNTnmWNLMalUD1uULZov7K0KQvxosipTyqUC+8Sqyio6XVTipkJydRB+oTLTcYvsVFvFEp5pl0fCXT1STHw7VUBVwp19WpZrL8k0NdOz/L9c5mQsR+t7C2oFQLCIZH5sKBwYrHlM9SKEpZC0Q9i4aToxATr+TL5NsJYzAa3zXaBGhl3eWRZpm2i3OK1F5XDBMrm8uqpQomrqRjUcBt0ckSkQJCAC0ZEN3Ly8zMp9PXT9Se/00u/pVH6eZDlm6+d+RAbrqT/0f9ORnd+Zma8ZyGaZGpkyNnI25HXM3iU19lVWvFq6EhMsZ0w9h9lyeK1Z5WguGybaOFuvQi6of/+9Jkv4EZIn9Eo1l4cF7tiJUMQ55jxf0VDeXjQaa64YAii9GIrWbEWO/FANQTJDgzE2AU2rOboxoRBGR6HGcIKIhwo4OniAkQoK1dOAF4AMA32cYqnHOcJ+vjSPpDzIOg4yDJMnS5UCfY10hh+kvYFSwGOiU6ul8mxcW9uOtVEH3FXSfgsRfk3VibGKMoTkaJlSvnqoziht5dIDKZZJEyfrCwHmpFKpDvXC2n4r+IoYMRZTCiZFY7Tjm/VbOqGNqQ1D2RClXBdN7yFMiHNErhTPDDbFXHnblOo1hoczrUClVq2pFW1timOk8VCxrDOr1ExZVCNQlmU7Og1Or1A4v0n3iYumzqTOVA7eqqKY7uM3OoBpSMhoH6pVcf9XzTEnUuz3bNvU0h68ttnZWNiWo7ccdHamSr5njP8MCNhLZ0u37SjzlUUMDOQOeZyEyHm9jk0Lhc5ziam/OziGMh1B0SURzE7Z3GagbU5A4P3FTDeqjdT+d3/jdDONVEQXqXSqjzmaoSag3ZsrQdSytkYW+DFBCamlmd1PgRlNBVVIcrIvurZ1KXKp29HqJc/E35qo8spyMkKAAgTPaICkTgUGBLQOyYiKIxeUxVQEaOmBCgQMWSC4DmkQdopitM1uQL45lGaTOm3qafJknSqP4XcHJGRpC0dBUL9RKdJrtHXUqlYo52NBvJ1sXo8FyLQuiOOwdpxoexqDuoK02zunhSE7DYa1g1MJTM8oXV8K5GlucNGJWuOo6r3WDsj18xRnZ079SqbJSfIitHa0yZUmQlRO/UluoimPZVQV4nFQS1EJ1JgjNyYVEBPKtlIOqsaBwZWwmp0vbSuOHi42U+YIz4SIHUNYcGC0fSCfuliEr6motXlwwbUk1e6kQTE/HQ3iOB78nUuuOFB8uLJTLwyXw77ZWEgqoZWP1Reg6INhya1/tM3W8/T8xUWz/12ip5ep0HoyiMEJwXQ8fQIAzqcza586t6MUHq7ggVnhec/+EMvU7qtRQPHr/OGan1OTwMBJxowTCTdCeV9r4Wyo3QjBP6D1DBeoZw6wVkvzv/6qNFKgCm9GzAHym8UagQs0IRxCWc4QOWM90xki57ukiAjKNUwHIK7Q7Dpf/70GTKAfhGf0XbL2PwZE/IYCBFviH1/RdsvY/BpT8hwICMcQS7GuoRwCvl2FiQovR/k1OBXj8TMqZL3FR6fkORxVRuqxxTikLbANEkRguTGXxSh/lybFCXRSnur4TYzvyhwbrtcIDEtHZNLxwwQiasPFa8rlE4HAfiedH7B8WBebsPxq7mT6d9GVHUxZJRNLJSd7ywyWychkgRQkWtNrTF5UgjY5LZQ9IgpTjjCji44VDvxXXmiEqWqC8rNCuj0+IcCay5eUA+PiqIBYLLilwybKZKsnUXZRJhHJBwYnik9oJSEIxeMTyzx5pTOTEQmh4KL8ad4S0awQSoxAXnqHpMZscmJyuPz+AmmK6wM2rjspcf0j1eBG/3fhf7DesgKXyPdPscmmsQhUyWEXSyDFhkL+JT/IY8+Jn+qZ/C+SH9j0Od1KnWR/67+dr/mxkXYMAnhCSF/TDFD2X7TLvSCBfzIx/dkNRTQsUSQs+5faP/ok+JSClKKCNVZAWKNQoA7oB2jEUwWuCJhEQh4AmU6Coq2Ms6laFSFP7TiUtR3Zw2J9XHOhdI0nLBAP03kqaI+RCaopBx5i3pck5eDRZEO55HIijQDBRxO2cnCNQ9Ipsk6gRbClDsN42pD9T6Fvj7ixWQ8Uot1K1gMk41EvuajVGEof6bisBwnM2sRbmxYXTxlrIhMZ4f6ftfnjgwgOHAbPgmERAbQrC0FwDCAHlyMYFRCETZYfFYPKkhUCNY36ThZkRgvoiEBXqg0KBgkAYdBeRMQj4knJAjBtEeWCwABUTDYJEjZEXoaDxELSDlFkuSNIhAyhCwXMHScQCkmEb4tG1UicqIuwA4gYDYPjSFqkEiWUgsUdzOTW8vv21ZmS78B0tEQmonhOFCcQG2pgKws1qXEjqT04TLD2xAQSIzLWCDbHpuZl/NN3yHK3SD6G86NDveUiCD0egj5lAZhiJ8fZCxAQvBIBpKbFm4IzqFHgEeYtxb8BiMtMWPYiDtvg1mHFEnHbge8cEF3xpDG46ygdgMbkQJNzOIhaYYRGb0AYIUSoRGRLLmBEgQCFgoyFLQjAhMprDtF0IU4qw+al692QP8+kBROC0+11sySMBgBHRldMj/+9Jk5oM4Z33Foy9M8nivmIAMA2BkMf0WjT2cQdI9YmBwjLlYz4vijcWclbDUslVm4KCsEf9HlIh8k5GVPCXXbugdDS955khlM8dlVMBC1ddRrTslicfGa2HGdpqFyDZE0DROg+JGRtOeQfQmPDUkMOh8pNykUFxsIJWQozRDfMCoPcbiGscOz8lE5WuGlllSKjoSHSs0Oi5NyoeCQiKQjqkNsqusoaJWvKdCyWiKrWyQkxIfJR0I/l8/qS7nxVUox3HlUg8jfToZi+QKGJCeIBMOzNhQtNqvCo6QnFRKRFhIP3F0kmWloSrXTHJKNSdGpVxmQ6H6otwroU6d/yAcADbJR6Iayy5ZWO1QkA1HMcPuRhGCFMOLRAuiU0B1BBeXcuh4L+8T4GCK/+Hf1Z+9YwpnF/4xF+5EELK/CPKn18s4aNCqLLEzJyUpCzVEEyHMWxTBNSDSV81hLMhcftZTC9rm6h3ZWqF+5h6OaElAM/KmeipZoiAJmTPIStYBjAFUhcWCoJlEAceAQM2o0v2ZoWXtRbUCL5tfU7epgq43lol2M1pniVQizlT0gYkyZ8l4l9lYEiUBboCIEoEwEK4M4gAdRljwqaYUwzigVLYWMkiVEVHyJ+8UQ/VCY7UnWKZRYQCXYFBEMElDGkFIkToGKVZeSEBoDTSy2X1XK5OBkEyEVhP0QgaDiCgIl0lC1Sfkcg1K47DRrRcD1h8rLR6Lo6F54cS/aI/MiseF6IkVWF96pXLYkjwWC4dmC47H0RGL31hCiNScU0JayfLRwPGExddNBLi0/OF0BZZlSa4ytoSZjMOfNFoknly+hklM6sw9aSK8fQ1cTdyQysXHTjTCkzwxsZr0espIViuqwaeAABiGR6UO30t5qslhQ1zGrQjOOsWGg1MMptFIHGSFiYaWZFc57JPhgA4GHVDVUD8pV81N6rF52Vqfkhcl/hz6tI3M55axrpE4U/ynt8pLkpZ5XuZdLZS0M+I+zLAsc6rV55FKTqzcInpqFG/K2lucg6YMqZkcpIWiGJOGUHmWDlmRIWIJFzi9R4SJ2EYVGg4LhBEB+q5aZW6Lw/BTDhwKQjDrL9v2uMMWHBQCN2QnBZCdKjT4v//70mTohzjKfkYjT2Ywb284yAwjYmZZ/RMNYenB47ziAICMoUyCkqQ3whqPFuHaAmmmXAsZ1lsBQhFlOJmbBwqE6kNLmWiPRURiYSFHcYpENRIkMQt+bijIo9RinaDaN5N4dxlyOk80OHUc6thTlahwtyAP6KZBpII7x3HPEZD5LzBeIxHsyHOlySljLifrCrlWqjAQlCXSCfoWZCOWVWzsLiTo9lMhcFlTq5eHAnlyxKdgL63NjBDWimbl23j8c3lzdQl25N6nUacgMvPRCYyvjjBclHBRi4VKGK4uUBWyrTUpToP+ESBrUSSS0PTOXNQaYjmUKkWI7AcLxDVhheEqSbAcLw7qUdx2FGuECEESwrRGmjn0VRyMotM08UbhVBhYCDQWalWWd5CccXnz8ndz4gYYlzMdlMnChg4kGoNZER4/4WZbQz96fYObci0o8ZJToGuCGronkSJSGNHXxqUXt0LpEFcbpmYL5z+9Fg1ILJGUhOSnM+hWDDckM8ZxQQjyUb0AgKkqEShLBCE4BWxUwPICFAPOSsgHSjACDgFAhYDgigiJIKFoPluwMCJonCBTlwMQ8UMYC6lMTU/mI6BYzoN85R+F3HAtGWZYuBKFOpm6VD0KOpFFej1dRNyBmCYpVYQ+JtTKREI2MpF9WKZOn4rziLGq2ZILgubeq100INcv1U2m9DczjWD0NBJNijVy1GiIpXwFc8P+AzJxD46sRrlheNBmRfZ2dkkkZkPjOW2Z/rUBGRW1phOlJLDetzEqY12Sz1lRbE1YYYsbTpxjxICVYF5Yrtla4bbuAklHV5FYtKeB6TsOGF7GnT7W3ZjPFisyGxF9zq7VbYnYe4C4Q5bZcxUKeOcNWRFRFwwNiU3DQ6WH0OTrNFEAIAALGDuZG+MXa3/ydnZlXpBThNnf/x/nrnmnkf/YvuhOG9IdVlFMrmsJOrchzLXuXCqK4ILT7Of/4XMvjffJ4XxT5IIQksX/E3Yv431NT/kPONqf+fms2DMBi24VcND09eKpEewK6lQAgQwQQEIqEIqFQUJMBwDAwhw8zLDRFMRgPQwExWx0AsSCENDkisxTBBTAFNDM9gjwwFwJU1jD3CyMXoOox+Ap//vSZN4ACJR/RiVp4ABpDYiooYwAdxIpKVntgALkQ6OTMLAAjDQDcGjMMEDWZIz57PHQTDUkBEaM4CEzhS09+5MreDKW8w4iMmLYBDBNBRE86ZWFUQwFhMTHjiyk3qoMqFjQCVIdm8JFgxeZsYwasFGWjJjIiEBBmJC1UykfMmHg4QQuW4hW3QoBU3zHRktOYwNGMkphw6CiowEHMfBy+MwyAwsYT1FQFIhSplqy1ADLiACjAAIzMQUyMDAwIYWBpgDQMLCYWC0twwfSHaQwNwnZTJsNwcZTcOEGko5qGBABE7LO4AAoU2MBBq8pEiiFwAiEgQCytTJg0mftg7BXdbI/18UCgwBQjXWX3TzaclOpNuSna6xGByFAKpFFJYqJKPC0V+s2ZVUcdRx4bcFPk1yKuGzl3Y0s90nhX+0h3WDuPBKl6oIff9ViX6+GktxiyXrEWfKYyFkzWWCvEu1etHQaq8u42a+Fexjyvz///////+LQ5zsqZxVeSkp4nG89v5Of///////uwoDADfOFA7WXTgVuVh2pfFnVpwAAGAACAAInATKwCFNEB/xddGt4AVtFWKyKGFcXVMIoRhAkACJacFAgyCD+XAPTjmSaIjvPFooDVbY4mSF/n8kUfzkMY4pHeUAPDjTBEgTeuJmmycc0mHXmgiksPJUNI2Qdew5m5947CDIdx3IMEc8QqxUe7LUDRvzfy31ysnk96i9MvKzArHcgb5C1//N//MRsducyLZ1zytMviYP9xXqf8rf/oL/////cGmt/Fe53////n1DVSv4XAEwkfDa6YNHL0+V9z60hPGbM91cTzkBM3I8zMTTKxmFRcaJFBkUyGj4cZpAphsXmbR6YQBGL4YY4GLFZtyKYMFGJGppAuARE0cOMiCTETo2kwVlMUHzDAQ0M4IBYWGTFhAHE4VFDAwYvaJEYOEUbDGDsyYTDAB3y86MqXIAB1wIgjgEKBimZhACWAIWIm4KUMkDApPteT/OOIQFlrE0kSYEL+ILAEAXMFQBVVdiBaQrkjgLNqDpQP5KZ0vkhKdJ03ViT5xRuKFqYyfSqThsxj8SZzSyF37rPKKUV6SGIVQ3o69M5Ry5+pVHJO/8SuZz/+9Jkd4aKAGjKD3NgBGVqaRnsNAAnoaMi9c0AAVacpDawUACS7ZllWTQ9W5TVOw3ZpLVeBqW1lhLpfLcbm6WZjMsr2cJbJ6OckmdFMP/NVa8zTxG/KoahqCKaHaWpUoK33YffV5cLViehrlfgy7WHf+IgaBoAAAyAADlWMp0kg1YOspUqr3uXGm3rO9k4FJRRR/rW/0kkv//ySPf01IeiPomgnc6XUR6lJ50qGGNFDoPVFvSMjefM0Ufrf3ZA1ROmh4yRY2RWzJoJG1zJB+fTb/r+emfAafA7vZAAFDJIxMbAsxcAzRKlMuaI/h1DKd5ORwUwUEDhq5M+i8WYZjwdGGA+ZpIxgMqGPQ2Y0Ap7aBhURiIJtAZngCuQALGBAktM+GBTIcIGBLmgBiRYHBRwGpSBCaqxaMwAl+YKQFtRJgYKNoqA0Ij+jawEEC06S8KMqKLO2mrlLLNeTTXan06ECrVRoWigReVqTDg4EGAl8SNd7VHOSKYLL2vK/XpJoHgBo71N42NmrnMymYOdaB1TUVdzEtoS7k3FoejcNui/8WgWKU8SltDAMci1JKInNbf7J8nxe99rDmTlJFb8puTkThx4WWSONPNBEouz8chp29x+U4Q9PzCubcTsx/OSMMgBxJTPQQyZ7H+epZKwkONdb1jsZdB4ZZWdaA2GbgGWSxfLqNyZapm/8Mww8QgBA5B98Thjo+XD4ArFgAABxksPN+jcUMnE9Vq28e6iVfH+iQeHsZXWpzxB/qc70Ic5/26lb+EBILfE2Do4zlM4sP1u0wGRvobKzfHA3WdtzB2KDnhTEpTLfZ6z1+tD/5MyM0B0alWUNyKpSGMxP3bYxPjOUJDJi0+AlMwIDFxQ5lNNoUxEIGhHwCYxIaMiPDlwcoch0rEhQxBiMqv0xnJwoBCYdmNA0kuJZYxYLjKMYMFAYKhIMCKYokCywBwIPDDgJMPjIFA9YBfaLZgoLrADw8QUiZgQKGGBUYcABisOwwAQAAgkhKHQaWpRuQwLkIZJPgQAAEKmDQ2JD8xQGjDQiMFA9SkAAMQgZYiDDxPAhEo3FlemHAUY/HZkkSgYJmKg4DQGRAYwCAgsHTGQrMHBlBEYVAxhEP/70mRrgAxVdkx+b4AApzDpCsY0AGOZuSOdvAABjBxkb5CAAGN/EWUL2q3OGEAYYQCQkIAMG0u2vuJCmXKUqWshdFrrKaaRv9Suaw6JvlQu1TQWu0QhUoA7rsHYcPAQLAYAAAtG8y1UjXBYcvJhz0w04Unay4LfIptSlUpo2NNlhbT2vO/DTUlAEwHUXvH4qwhsUla4zdzXhclpcqfyfjNZYaRui+r0W3SZ0wiN0O2HSx0YCjM1Dz2QXfw53mFXLDDef2LnP///////8u5VjqkmjX88pEo4mBAAIAgAABAAACQAJpNKZMM1x89mr62z7U5l2oGSkjzGi1JqtqWi5NVQWmicMrraiswQPl04cTM1GS0k02MDZzInk4BFjAkoHIExHOORY7zEkjpdHebyRPFExrOzAwrUfNzZFIwZBAzPMbmaOm9Juvudd7OkcZF00zZSSBgYo9r2VQ6lJe391O11LahWvlxNJTqWpC6NC///Opu53T6z3/7n6kazjmIgACBAgAABZnZajKagBnAB5uoSaaNGxNIKgjER0ykrMMARIhAwKYIJGVhQgBTCgBzg7CXQgG6zzwHL1HwgMWpnyRBcksojQyogCNDeJGsqEQkrYVOhmvlebN1/r4QwGmLpEll83pVEIDNBdNorP1IJqMuuNPXtAsZYc/DBGWxiTrWfeGnghmG25IyLRUuQoRTWgraj+0lnxdiLu1YjEy1+QOPEmSYufBktlW3TmJbIIjFYvcmYnTSmPw9amflle7W3D0SvZbnJRUr0NammocpqaE9jMMRXKtfszUD2qSjmpqZkUNy+KwuVZRaRwxWzksAyicfOnf6dhyihqfs+9tHZo4q/9b4xIoCwrTsFTMG0D///////01nEkTtlj9bQAEQICAPRpRx5oWZXnucz447v/jmvtZt7/3fxnJ9/A2190I6XaOdEFDRwuH7i5wNAGgmHgAQXkSCYcVjByQ5w6smzKLQ2BGAjanic4FBOdGKXNi9D2Msi9y6t2vcn9X0/D+FaBLKrJAAAUGrDFVTYMzRnAkSIlJs2gohMojAAMLMRg+Z8CahGZ52YYEW9NCaTnMGCKBK1kxolRDQOJroYyg00UuyoMq9u//vSZCKCKMJ5yGNYZPBZxdk9BGbCKTH/Eq3h8dGGtuMAIYp5aqbJoCW9ClMkyX8YSWtdl0nHRxBxUcAMJE0tzHG+b9mrB0qWKAQbq4J6KBOU7ywjUlKGAMpdhpzfQTblMlcmDHmrNZhlkLJYmODhqOtEbdrsMUz6ztxo6vYs1lUsxbjblQ9E6KCIVI7cQlUYVxRnKJsyYKJTNR8SrXT03wqrCUT1r1eHsyEIKj0T6FJSVC43isokktMJ0nuF5ACkdyHeli0nQlh046fpkM9eVDhpgRXHFcWv14s2XliUMmHvZdfdL96Vd6fn9RzM0mk5OW6819vOAMIAojgAAAAKMwMTEYa1rJH3y18OwTVpTsEttYakx8bz585c8iRRmDyMzpI00oJBgoqkEhoBXHKCrpGKGkNTX1bv0rajerEcSNiJRuTgmF0MstvsscwRFyrH7ggAOHiTOyAFVJg7udYOiyQaYLhZjC5EiaFDUFPZiYcACccFwuDhxWFUEwEFLdhgcYiHJwlnFeKGCgE7ENYaIBjS2bGbbdHyVghlCAHMEA1kO+JJVIi+rH0hG3RMavLQatBZPpRcBOBQlM0r08RKiPbvrmdwtePhR+QeDhouNLRvawuZrpZibSJYQCJrGbqkWkchmEWbuxNkLZ16t2cV+nYGMX0YaHHGU45RSBOUMYT7PQ9FeEpPSVHsxnsCGQFanztlHkoj5ShTItFNDedKvTsUyY64KU6FYXgyDNgGU5RjPfl9MhKkFaEA5JuA3T1V5qKhcKZtT4+08xrzK+mLqqTS2xI8zTQfysDYs6V0M30LOtBKB4qHM3mdWISq4b563VTy4hqZPR0WqG842RsfIJ7GhyMa5UCVYF0hBnLMV0/ZoDYzwlKpVqDPuUYrFGswl6Z+ik1pGUMd0pU1TtVQqoi8F8wESJLM3lUKrGQlS4HMgsBAWcYBFkiyFnIYo2rOXvSn/R3spsx3omqatk/769vl8j//71/q/OnmO0hzGDFvOmUkuMBd14/o40rVgx0AADDACQKDBjIFZg6CBmCWpnwghu3XpwYzRnKD5l6NRn0jJkWRAAKExKAAw1AwBASXSa+HAmGAQhU3orhwiDgpAU60VyH/+9JkI4No7n7Gw69kcGbkiMUkI1ZmUf0UrWGTwYOv4xQwjWhG4HOSQlIMITUNkrHIu05Cn7e+HEXVVj0Qtrg5F8vSoPcqjHTjAkCbkgIWiU2P1Km+egNsTMHgzDaaU6cZ6mSfSw+N0xySEOQs3zSLucAMJjVJnJ4JSQZBc6XBxMyGoEtaZN4IaAP5LVUH4z44QjYYHy1aeCWYFOipDjuVycqK69OcnpKeXotqsbJJSbjPX7298qHDx8toWmGlFkkZ2zrMWtNYV0LnYFY/Oo7VxWwvZ6zSYzjJtj+V0J2dXblqNmFLV5egvJb1jY2JbGtO1Plk0x95tlz4fEAAFTwjIwoF0DYmJUiaMSoNMCJXQjswcWHw/ZFX6bO5mmcqOpC3hA0wQH9VSzsF2XWkHmzwhXfq3IQ/0b3G99vvD/v/C26H+Wa41ffefx3/v5uJzf5fQibQFL3k2mhFfoXylOyPyTwQMoROmsNb2M+YMuJBnI2cgzzEKjgqsDLxrUZpghMRlaSamAGLiASUC2AM6Ye7y+UwEixpI0tFhEEoEHERHYsX1LeFUrJlWAb4McZgnkaTgikJJInHKxcFLZCA0lRuSjihZtV7X33WEYYxRNJx1Mi/DM0dmWLnehKpHCEOCsRkK/UV1NK7C2xMrdpxGPLEZO77OnRWBgCH2RQew9t5K78890vaI8MOpv3JRK6GWQ7A7VZa9Q+KioU4wYIlBiflRorD6iBqEj6GEb5k06hKKvQII5oBPhEMfBIPlpNWXwayKZlJQkY9VdSDaxtC+IFzM7eLhKEtePEZcMB3H8Pitc/fVKCYZDwyYFNW5CfH649EsgrymVNRUM1ypja3w3hNhueH1qpkbBm8XCLZofS3c/I5iuuQGC4dLbVVHoTPcJNkd4bKjoQcxyHMglimezLYVz4q4giAAY5UINSD3u3i0hqF85YvkcsT96V9rPNsiut9siLtt7vSv/+cKn/Id/1ylQrzzMheUEYXH9kUCJ+XZZJlK81tALiRAAOnmJvm6MmpCiIGOqTQLzOpwSTZsCBQYnMyCIlhATLItGTnV86cVcdrCeibEIcFMx2x4SgIZa3yWaKiMqoXdUCQEKnkzN29ZYzFdf/70mQngwmqfkYjWGVyZs2I6AzC8CP1/RqNPZrBVpqkdBSPQCrIMhh5GyMuaw0KtXUvjCwqHj8IaP2v5HNVFlzO3zbg35c+gcVRx2qFOpsbQF0uW9rsOK1tKYoK7yAtVBTdSDG3SdBHhiD+LYZqjcovDzW240DgPXOvsul3mVwNLGuRl8H9o2QruhmAIy37sTcSjMsgiej0oryuZeB2I1MikeF5SfMA7Oy8XyuPAntMiESSYQFQ+YkJw2EB8SyQOJfSDARCqhCAVT4tL1zjRwkLQ6voR+cCQgJXjxY8oH0R2DQ71U2RDGrsRwSV5gqWIyufmBfQy8+s8tcZpEZLPz3B7Rmh62XlTyzMAUgAAA3tIivychT87CySUYIWdMoZqZZoxrquKgcEohwlFU3qK5JTd4cqX8lNz30cjqE7yEIcWxrHqZYMhKHux0Ls5PvpCLuv0I70r12+37ukqvs1UIxNEdV37VbuLNfKYXS8ISiknRDQAEAcQ2YUybd8bE2SAzGsTENjKokiQKXR2MUMMUGLgiEGzsLDkQDGhAIKEhj8tabFBiEDsrudt5l6xJ6HNQfchIu4lottnSv1Fltuw57BEmmZRFeNA5zbLtCrG6b5PTUQsciiJcHEPovTyODCDVM5YJi+klP4+1Qq15In0i1WDjKUiBJQEUI4CqH+PUl1yfhjnaY6kJGdRfjTK2ChRssbQeTXgoS+mTAUReVEcQQ9MhIGpIyuNlyU2Rm9EAnD4eXXMnpVL6xccKZH4gjE4adMBQWTMhDxe7o+qOX4Ou2HZKoNE7RbOnWywXy64scWGT2Iyt4/J1J2u3jNWdwo9qh8oMjhyXOodwR+cNvla52h9dDpsZJWssIqxJqd5mrbuAoygQQBAAATik7M4DqXLxwoiOrfIxGkcnDGa1JyEXUIFCyJ+862tp8iZdcTiBmKawjR5DCWJRaLrdPOZkTBCd2KZ2XN3PrdrFj6vrjuxPuitovJUXLVOmUAAAEnAsELCTWlgxaRTDIFUXRkeYQG8AZYEAozJwSNKzuwBQSJqA1LZjDSI4pokUXJHJMOEwS4H2YZOCGnclSiEajxxNUGixLHsK4UfIYhplpM01a8OcnyQFJP//vSZC6DGSp+RcNPZPJejjjaCGL2JQH9Eoyx/UFpoOLgEIp4kux3qYhCtTZ+koUAz1SKWK8eCLZk2WTeW47HEYJJxeA+lePFjShxE6Q1xbRzF+ZiSE3P4QVocy7mmlCewhJXEqEOekrLkhYxJQDhrGBZEGhmI5qVz85Lo8haSzxMapzpEWmhiLiCmHkqlFe84SW9OBgUV45MLWhirPlYkDqWS+vHQqkoc+TECkI9lAzOQMvE9s9HVYDJaFZUXo1xLsNhKvJwrXyqOGFZsydnCYdXVkcJk/iiUpMMD4Tzwr9G0tw56EqlhETzx0IMQCACAAACDfQtdqOrF0Trsd1en6cMBCrEQBBGzVzK3JSfVH56pxyEUTCZqGEkTgg5Mp/4EzX7DcNnLFO8kSyN79h3h5adOa5pkc56P1anVVJ0+v7v8vl/wVp6JQ/dtDSjRABuXHQqfLwO8Oso9Hz8QB5xiNmiqYjRABaMBtCtJQqjoaF4U8Vg014XL2DMGX+qdqLiLvTUhVC4LIUhkyFsNhLYw0uZna3XKclNKB4ciz7LZjMjaRBE+nTAb4Qlltt6Yedcd2CQhGYTGKZcLyqVhqFQwQiEXFRVLSIahILQag+P4tRjgJR2Ix+IJHGKU+IgHSgLEATh5LZmeG5OF8ZmP5yGKcZVDGcMysR/SCKSSuwJ47LE3j4eD+XAHGKRoxJpiciQtQCGmHNIlbJJMHIvgcXkhGILqKiwnikQrBMmBuaqEZJK+FUSdU3JAlniMRTMQxYGCoxLiIMF+trLpOI1lXJhKY8FS2E1dtsRP1YE0eLMdp+G8tyHWsRV9MQ2tjdKFqOVLtcYARhAINMJTrbyPdyUrmT+WgEdowDzMwyN8xFQZwkCeqTSF2rKQrhhNwHkFBHNnQu0FaVBKuoyVnAaYKLJmFhrjXDgkTRSXD4ckU1CuoMiYcwu4/QAg6ZFXWLHqgom3UTACQBVIOswcYDMgX4HOmiEQtGMigHNIgQFKoeoFVlzwEBUyrW1nHecVmCdN6XPK+kCNae5vHWXZPR2jZG9bRmnNyvbcSG1KEIghkUxLxMHlcsLSpkkq2iUvAi2rPWC0ZB4JZAaETC2PZ0koJB4ZQls6Xn/+9JkOwE4On5F2zhicm7vuJUEI34hZf0WjD05wag6IiAxD5FdY69EvNlCY/EooHi4k8Ytpnj9Yu8mmuHrJ4JKc7OyQ0X4VKxErNjM5K2KU8KGaJTI+OJNjzi6SDdWUmD84V0ZMhPMTy6WM4RiQsXk4qkhiMgjySZNSYr2UhUEvgYqDoT1KAUy+SzA+PVFR9TJzMuMwPrjhwuFRdjat80gTsThHYSLkyB5aLPlpO/jKQ9PB/cAwIAAOInTAakvEedXUaaZsADARpEFt5hPbmyYBs05WALZDoZlurUz0lh2rNVnM+yrMiaZSQgiXnCRPc5nNnJG+7r5vDNqPTRQQMAvZ5cmwsvBOQODI0kgoIbHBECHfr5981z6dBHZjiMpHeyQOEFXAuRVlFAYSpUcAHDaoDFEbAHkh4Y0g1oAEMmQCm7hcpgQqCqtde6/oXBkmXLLFnyiGnCi8maLD0Ta3Tyh63Hl8C1mul5PtCGJdL5hrtZYTiN9HIN+nYB/FgQpdw7n5p42ZaVzEesZPUNYHHDeuIyuZnUB4q3Uy+rnpXIZBQmApVKncLDWuF+qugPE8fisQ43H8rTuTDAyq1yhzYVCqfx9ubI/dQGGAoYNk02srS+ouG5VODdHzAXV1Q3wVe4JE9WSdrbmVWwHNundumFRvkUxNT9SvMPW1CGCJCYlSuYzlGT5XP2pUPYH+bkMM0QBYkLn0xZQQUQvYbUwbB0uhbEzKxKYJkg+kgJRQK0cAAdABaISzI784fa7Zf+t4tyLO0jG1qej1n/Nppdbqqv56Z3pr6Gd/X3Ua2hnr9N4NUnT4xbEW57k9PVrOZGRnZXBETI+hpqQM5pQV+lUi2Cgwjf9TUgZkZE6Khht1yRSECC/GsH0CpIECioJpuxI8AekimEVjpE6mByQKFHsLmRODHj0GhCJ4ltHMIUYrhqSfn2msspcRgF/KkhajSTaznSnT3FuKVTtosjIo0kfsJxcFQtHYu2wy2zB1MGA+0jQMkgkRAgNIlw+MgbB8mI3WPxJgGEMHCEVoSUfyjutroiMRCx0QiIEFypWRMQJJoi6CApLo2kJKiIBWkBPVbcmAhU0IhptRlaaMSCJlMUSm9xGD5BZxf/70mRVABe5fkZbD0vSYu8IlQRD5l5V9x+Vl4AJyb4hwoowAVQNNMyFIlQuUOmoLAbabYHkRI84l0QyjMKoB14pLEs7EJAwlRGAtkEFOXxGKTTLJZN5wgLNpkZwhmnJpMlRGCQhUTSWKPXbatJqxS0DBcgA4kJDyMGepkZ9PLItB1YfyFjaR0ciMaqYPVDDbWz/PZ08o/Kf/1Ljovu7+h/LtsHuxBQ6Eruzep+IPwSjw2NjnjKRtDBUJniJpsyhBc0/RWTOJMXsyj0d1YINHoPl92eLavm9aTbSgbzCmZuEKnPco0nzZ3OYpEswW3ONkQyzy5I5IWjQIEIooBA1Ep3FCBzOR4H6TB8kmJuMK8zcSVSvksoUKfJltbJGRQm4zKtsULa4vmtUJx/LIZLxQxXBSMcR2wRHqEqZRP7sMVkVzc8fv37lAw3Mj5eUr6BGa47XO8jwYSuZsyQYO4jE3qyO+aqxsOFJczPIyz7Mbpgf1mYGCLHtErBgapAlg4c9wIDyJBkj7q7hahs717LeslHLLFTdW/5pNamYL/EOA50s1Njc4ywn9Y0bW4MLdramc4uY77NqXba2gUiQXvtHzqC63NmDDjB4HYhzDVVlP2RMvSwW2R/7JoR/vlP1c/bf0aw6/Kv/5Be82M1sJbOPflYN//6eXug6msbeqJEnpTQMVI2EmpRYl1UM+FGWkQsn0RGWzxjzlHTJ4j6kLLAZWYEDCwMHCCh1LUeBzNyKmSI+noRtM8Q8Di3yjNTyMKrTAggAAgAMr/NfpI6Bh4pyFxeM/uM3EM5TYI0GFrCgw8PULND5gjNHigGicZ9qBqZlDoWaCUUDJQaiIuR34pt0JgVoI4mBAGAAmkGhoM2qMzbUHSzZpCAQKgTTqhZyVSAYXT0NWFAQ8FJwUITVGhymBhggk9MKXCwUYEgYKhyEhK+wwhC0kDLBgCLMoEMghBKoIehZaJMBkwMDTNEx4ipnLlLzCg0H3vARNPKBTHkoyFxQs6By4yo4xASSPg5LpGIJmKDqwoA40zgvG67XEA7zyoDEDHhEF3VMCUCCYCBJVLPdhuNNLGATMOwK1wSFt87gGJtORoQHXXEBw+GHSR6ghWwEgkew//vQZIWADLqKRmZrQABzMLjswRQAHc3tI52ngAm/PWFDmnAACAdBZyEpj7rR6H5TDkO1ZZErT8RBr9M8sPwVIabkSfKUXYdfd+miJhO2vhizkqZO+x1prtuKra5EarQ0/7+Q9IYGfuo6TldfSL15NSv5Acmic7SPtBF2HaGPP9///////+xJ+HChMMQGxHT7uRQv47stgN1P///////41GMYVEJU8NM+kMSvN35Q9EpIAAICQhFAgwwQAAQOZ3V7Nrf1K2wsIOvigqLA9L3mXRavstLOx2dkZXdRcOHJKJj2IIM67s6GqpZNTnvVoihU/Vl/ofX3b9GozyVbOzJpmqrdLbpau33kfmHKytJQUIVTN/+8rKhTzOxp3//Kp5Bg01gJkuukqRSFYT2QVhAsBKG5fcQFRw8LSAKGMQPMgbcRAeRCkHgaKLlF9w9Deoep+jdkLcYThZyYFahSnOVQr1Ee9RqJT6iiMR/HMnENDmN5WMaiaXy4f3Rr2Gq9vT9OVUMjeonKK4ONWSzgsuMBvurqoe9WGtDlw0rTO7eRKMjHiC4w2tgpEk7uIzqvTWwxVdmed5M5szCzQ2583PYs0sVTx8OL6DE/dPIk+JYEVzxqvkiV+6yz/U8DfYWe9baY9uMDMfc7xuf3rpyYImY0Rvlu3P9uo98+fe5K0s4R9W9488a2a7+6xq4YM7nh2iYQx5BTL6SRg27nkdWZf57H+ef/1LjGtT1QC4rEwQjgjCONEEoai2eTGojGtfoGfrY0eDf//GhP+JjTz4peUGj+ccdkhJNGxv89o9j7fqfQW8dbqJ3Kg+O/G5flSj//5pYH44k8blqA3+hw2LY+/5UbiZy6EcUsaMqAAdxgqOCJDUJEIoEaF1iwgEbt3TwQwNEwcPZIlIwp/U9YeXtDBOEMri4e2AmGBiQyiocHJBMyywCRbWgiLT0WsXTrIy6wXTGMlC8dRgRlx2cnKGaZcIirhYGkWCUsKC3HRMysKmRSCAM4zA00VMqy45uEZQ1sCV65EhE6plddJUoWNNYki065BFsySlDZLFuBEg05iojQ3In1OyngkKWJyaHjwnIFYaVD5lVPqqt8vzAeLsl0Jo6yeyZ47P/70mRggLdKfsdjLExQaO7IeCRlPhzZ+x+NPS+Bqr1iVLCNOOVIhlE40jI0c+zJggNXSPyKkJNoyRG+ZJbXUgThQZY1SKxip5jjfQyABAgAA0aUVxqDEdTh6F9Pd9CXw/EPH0boNZqIwgXLRTI5Ss1Q8lxowjdCNwgzUGoT5KEYGxYfyMvI98YU79Ca0YBX6NqfEdaMhGE0zi6E8jClSCf4q/VfyEyM/czDFBlamnknK2IOfw2XXbtEpoEANIKABgASCg0eCEgYZFCZQHHCQiGFoRICWnBpNQxLQeFiODxQJbYB+JNcqTByq5Hm4oHpxp1MzJF87dWyp35fhGTnXS6XLg5NhluT0nqjUSEytrm1F3WKLJwmJjKIGBnTR0QOJ1y00agk0SGTZJMyxMMxQAyTiMQKCF56rNadmvUzpeEVOlMiojKNxoZTRwcQzbLYQZNB2tLEKjC7m3HIjkIT3G9QtnZmNx5nqIu0aDFp0YWtA0hlMwyyVZkw2bPsmUNOKSXFFsQKXcE6VbggmRrKqFnTm0p0bkevrrrIbdRA6rVNuZ4Jct+cya1iNWz4yhrDJTRVM1rT9ty0I21bSuXyOfCJUPLVDkWZQuFb3aF6QFKOJlZaYQOxNy1itbrCdXBY4VA+XBQRymccj43kJiQwUpTz/MUC3WG3qgt/jt/6a8s63kG4eQTY+gmtImlwoAHUG7DQib6KAgYMlDhzdBNFJ23SWkBgRZtejU2zStOCbau8b0PNUjThMdguu6LWZenQ7a7UokFodlkTS03U2eJrC5SoL8FEgH0Q9Fe5OuTnolizVqKE1JLgHh3Xj05zJUwKH4aOnkE4B9y6NRowo9snIiI99PmaXYLwWV6DTR+bWMJKDxpcsTvXUNNpJG2JoFFGwdMB5AdKyIkjzBEqROXImBU3rRHhQsGyymCFJuJSER1YymVGJFDgLwXOwJ2kcw8sZtWMi/JAUi3g6pNl47I44o29ZJVyH0uOmiQhWRMKMQmddKEoAAaRZVOu7I77Km9upMx03ynbZPPplNH2JKhdJTnp/lAaniv7kWfhn1ENzPjTFX82n8Yb5KITm9Mw8MI/7PGSlR4+qF1V/RXjuV8zEbmJ7K/O//vSZJ6AN1N+RuMsTbJpb8iFHGW8HpX5H5WXgAmoPWJWhjABc77MHfREirVHaTsFTndecXNDLu3vEaTW29ZC8ygS0HBGnIW+AqppumUWDryQ1OcxxWSF0mSRheYUJR+J8RITZCi/FzMQf2HStZG8/EubqpV5zpJsQsPwvZBiEMZ5pxjTzJDTjxWPGx2iYL1dR3NEQHj2sY6X5+JN8xo5RyKg8nyrhSLF3UyfZ3rAf7A8cI8JGMymb3FwcGqFM+XMNtc6RW7DHnFJsx8ucGFSaeDDqxt16vWTPrN8P387fH72M5vJYkNujwW9y9bbgWq8v7s1KSy5cMWbosVsVcG0WDZgdVmnq3sFsv3KDCgT+NirXEyt47hVji0o3VcX1pWzF229Z2bVJHWYi/iBM2QxwGh2ztIqk+WJ/Mv50j7Py1zL/X8/8u1pf/lqfZFPrqnN5r7ER9WnDWeYWuTcOsoVtdIxrlkFDWKZdz///8vzdn/krCS5TdjjsErL0OUIHAcmlVcjiurE0pjdVYalVBKxq1coD1PxwYtwVJWACABACRBwBgDw7HIaCUSEwFAQSsIAQhHGFYBoYQ4g5m1kZmAwFYAhuzB7A1MMMIE1LEejFWCKLAERgFAAgwI4wpATDJfGiMpoHMwDBcGhYZZB4YVgudEI6ZrkkOAIYIAMi8YKAgYOAgFgFMay3MUQiDGBamXXSXf8DBOBg3L+QIYRiIYgiEYXh2YNAYDgFauiAgYEAQiGgQMEgIHggV+YWBCYihMHDiYMA6IQSWQ7qAFfjpvMg4YJAUIwDXWIQCQAg0CxYDwgGI4IQILMhQCV0K/dBKyH1CHnT7sxtLuMUgoAQJAwtygwAAIEIDq/alIEhF6M6Wi8j+sucy47ixHfkDNJLmIQHJgGbKzF0GHwtHxibwOnK5M6ldaDvTT/xl6IEbDaqLtl62qKs1lHNnEsagmGwyTL3ZY5kKgKTu69E+yhyp+LSiddh8XYbHSS2ZpHlh2JtLgDCPXafHN5H5a88jQYUziQNfjDqus8jiufr8a9bK7zDVXt/Cgvf///////2MeVv3Xwu2u6z3na////////nW8zqZv5XoewxTTd+V02jAFAAMDQFgH/+9Jk1QANEopKfnugAJWQaR/HtABgvaEufbyAAZmaJIOekAAMJQmGgkAQAFOuHxcCYB/nOYsiLBsLrdy3tRakrLhoFUHKBxGIktAJ4AD8HKS7FFjM3l9zJh6FMpqrqclzpLmZfKToGZf1dRgibpGiZIFw0TT9kWmlBSDKJQ0W5cRv1tfQeyDUXLiTObpf/qsggyGpkr2TrdNv//2/V/rS7zSh/////an1Mt6v/+dcL+WYAAAFwACxvEGa0Mi0CYiXmTCZZkz1QNdhB5oMTDhYqQfBQ8aCZGboBjIiYKuGVSaY4YKF3DnOLhAw8mhRnEIbZC3QNPQtTTLZFwm6rLi6EpGJ1WsOeXNWKzRlSEhyUq3Eexlc5ANCy61LIFpZbDjVWXRtxFDmXXoQlS6bWdy/CvF4Jm5TLWvV5bAtLKkGVjOG0R0o1J7FK4j8vY16Hn+k97Kjx1j2OyufuxK1PS+XRqLW5qHonWyiTrynC1ao5mzNdpcr3bMYm4Yg6MQ9agaHJXGspbQ00BTW6SVSqX2qKYpdzk/N2aWkv00YlGFqmnZZII9hHZZhulpfs1ZnVqpQT9NGpz+Xf2ZVrBul6PBbTx/WjNWG83g/cg6ZDjSkFj3IVjKeipbk53R6R4nPCRRTWDhhgNMk9/1svKvXahGpUilOeXsE7iQ5rdQaeSqXHOmtGUemOJYTC7Iw+GQYEh+g09tj2ODul/VlP6OrlwIAABZvYJAYNBRDKJpAxtwQcuNcNN+KFARozFz0aHnNhcGkBZsEEHJaDhgB6NMBcEcABiZoJmZeHPIyGSsbKUWEj1Xu8pekYzAx0S/iWb1l0WWpbHkGYAPsAdX4E8T0n49AScI6ZKUdG4IyLOT9hYCdKmMIaShfNJHGCbR/qEYrGp2wM4vUFUHUXMyTdLEjmsXdF7Z1tPmGblIaEpFUyF6lQhutmzhCframXps0W2ZVl62vnK4N7I+dK11Fwf0V1HfJxnNhL9X0eqVPPVMyMx5oTTTbHo34UjyMhi7gGbDXC4gKncJSIUu+yq6C4yVcG1iaoa4a0eqWBgfMrW+ak6lb7/////9HTut/kBPAABBPtoQmBU11YIWN+lXBY1YeFKorQFxNrf/70mSTAkhhcMmzWXpwWEk5FiUCiCDp+yENPTWBZDRkDFCXoXNEFNyIJsXwcaq1F4sdmzdAau/meromqInmAn++rGN/4MmR/o6wX+n4IXoyjipknnZQGIY+R52GSD/1vyHygMAACEvhSFMREM6qM2JNKsU+aI8FCQ88GixmRZWcAR0x5JWxlhCUC48OOA0UW+YOHAV1CQ1GxiC2GVRQ3B/AQSCnWqy4hjn6YQiZBRZhRlcdwsQ6C5pgBpL0qghx1D6Yg5i5KofTUpjmhRDcP44kkzKWEqiStCJJVHVaoWlE2mKnmk6ENR6YTxfLOC5R6GnKym9Kn3qvTCDRSobn1T9ULgi4TYjCUZEopLLZYIiAFiJyMbqInHGB5yFYpJco0gaAoPFA02ISNqCIoeAZC1PSzDuFF0bIqUjCd3sHsmLSJT4WY79eqqjr5ZCTIlmo7Mw0kxmZ0ZE1yi66Ka+7Od7IqynAx8Szx1N4AAASqgUrXZz75H4kHjNtsyKaowUOII7GKMYnyvQTTRXf+d1F9fD8wf/lzCf+D4xvi/k3jfxL0/+cJOH6I36EfPJyEI0yCwUPUe5MFep52MZ134whEM9X7yIJRmDfGhSG8iGG1miVHT8GjGm2LlC0WsjwcIYhcmaACAgo0MAz0KIwiIOGAESToMCCVRCpAtcVACx24wpcKCVB5YytKRRpnCYhSEJbh+i4BaAfaGukctkyXJYjmNEcK5biwL4gY4UpVsG+J43KZCEKaFQ1MrSXkbp8liMYyivFzLDELcX0fhjrkmqkVMFYURCR6lFU71Q/cHIxmYhpzPIT5TvV9kZWSRlRLtHrCxGlYY3aHI1DpVUqHIxyRaWfCJyEX0hJHwfaiVxIVN8XT0fxzNqjoRi4cMXKRSHpYa1PkOrw4MVdE/SuYmpklaGzyxjSPGwViuXVh4r9wyVnrCwqNLlqQko1CVrqFcojpXmy6quudWM80VT5TEfk1YeL2YY/BAEBBCKiVUJ9Q+O6OqQfImnv9k4ZFiFvt7GycJfaTY+lnYxLXzIvByrNsUhByqCF20YcUSqByORz0REc2w9X7co7exVSgohYJ+1wIf3zPc1JPvcWXhc1wLeh6M2zf3Ci//vSZMCPCQh/RgNPZeBmqhj8DCP0Yun1GA29k8mOBWMUYQ0Jt/Oyx8RUwLVhhI2TCByTUY7DgaOOEjgIZgrbNHMzBCoITDGxEFDRMMmTABgoe6IqBqRX4xRMlvX1VVDGAphAkaOVLiaDMG+IcIuNQJCcYxDmG2uEMwY6tfHMfyiNBXoWWZ/Hsabiab8thqsjYQ9OEYRyLbF9XqovRv2JaRC+oG0f5uyMaeXKsJSXg4UngkzagGx2VidSB4qKAknJdGK4trNAfqdmOFVk0unWnwcniJaRj8sCe9AkJYmOPmSQcS0OZlZYdHxUhPhwXNLXyrdhr17lyxCJa4kG5eZIZoqNMhYYQCcbLByhWlipaxbd9KwV0CFY6TDs+Cq542qSIThXPDtNASH07V1S/4KcZoJmuLnKkplQ5TuI2ZgkviUtKgQACgQjKdDMHOsLZC1EVFan9yZCqtb7Q8Gn1JapB5qZwAuvA59G3ZjxhRmLxUdMF4cswsL3qnNbvBrl5eTToXfvhzAggZqB547N5qu9fvn1VFPUrRDS/CfSHpSFpSooYKlH+xUyBAMxJI8wjYo1dpMxGK8yffA2zXs2sIkzNJQy0FYzXC8wZHUw2CYxFAoDBmYgBOCAsJgSBCFbTWIFJABkNwcUFSX0XSOoAIcv6xI6oA0TYg3kJnkRzY8Y0TSOyxGKYSgYwzm8jly/G2I+NxjKcWMnJvHgIwN4uASINS4JaEZ6rbHBpJ+mDzQB+E7gLhUHglAcQgYCiMY8KRDuQg50WW0aSDJSlB+KIl5qoUuBsKp2xzm6eDWxn6VStRKFMikUxdkIakNQlPQ2I3GdYUt08yqNPNpgKRCGqRXXUiHp1nUTEoUwrlXKxOS6X1s1Hq6euT3amcTdic/VMpp1fMtqg+Y9lS7UsdGqx5VqY3zmyvGdngrlTQFhxcHKU937AvKCdhVDpvhNywrmJ6kIjPhgcHjjqIxrLuCkZ3brEDbmwxp4AADIAALqgXJwWDZmUG+8LGQWRj38jX5Z/Rf6/696ojlecOLnUWGGIAhg9PkIYSftFTyjEXFLaFA0WONZxVIZwIILiCT7jJTueMQlxl4tQJN/92UMx5piAYYjmJYpgUz/+9Jkzw8Z9H5Fg7h7wlWlmPkkIl4kff0WDb2agXY942SRlJmdJInYNpniab8PmOoABOjOxgLC6L6P5gQONIJhoMsgmCEQEZxUBd5XykkM1ctjhtQFWBhzC0FWAFUBXMtFdk6wVgDcnwjY6Dts/kog1rbcFpr0R2D9gPTRHrH0DjH4xFjLQONHCvjifCHizk8N2OuoaNUJIIBSiZGMT8SyeLYpo5fC5oYtnEoC/DmI5OEuE8HAGLRMBigFkKEZdTgsQySWFQerSrXTJeiaiNyyvHkfKmJggNFAjukbm1o5mSGakZEnJaGgHLJMHy5mwdxLQmR4JSsokqE/ChBYuQSLHcrnZfEhQ7hwIp9VoJVQ/6OpCXKGCRWp6WsSjxHgoZVIQ/9qGI5Z/bEUuWvQWnZQd7wFRsD4Onyc29OLJlgAAAsAcyISFgEVEqGbq6P1mcfo3RP5v87GNm5Py8hNWO8SCQ0xXDqlHOgyqykOU9yoZnojs+WiUKTI451VinHs87Pp19vTZub1/qxnlZ21/u1ZGpBqlb16b///0BV1FmQQADjtBp8AnoZ9MssNCuMorAR4yZESeAQ0YoQFQ4oOZfGHBQ/V84SOQQLQonreIckhHVMXJUoUPkmJ/DdZUOQ1KpQ4j4RJgl6L8SkYpulCX1mXBd3KdVuI5CibzkL03KQkpPjTOloYT3WHNOxZ08j4zOfyHFj6PPZkMdDWElzC9R0h1gwH5eAMSkYVE6hNB4OzEfjgQzI+LZLMCIXSsJyQeAyMUI2NqH0YhCWUrRCcWys4oNEMG5aTKQQfJ4UlolD6Vj+iMsiKHZCaOj09Qj1Eak+KMWmBgRFK8SUNaPJ+tFQhsmFCUTRzMOZJylogrV0YHzklQrqGtUQNVBdHbVRHKhJ2kBABsWlFBJD5MV0ogcoLLCEXBjbQSdbQy0U0dQgAAkUvBub6Jc5qlHKQ9Z7fSKZOf3oUzUnzScJ9PbiZ9KVkOYfPbNgsBCKRX/c4uCuZZERB4UI0Tz3fDun601QtkHQ9Wz85wyKyyzYn0U6Tbp2Fv5nk1prPIuctljcL7w9zluYxv9tuoeIFICAM0SkWmmXbmGohcCKijWEDDDDAB4LKhFTdTP/70mTUAzkIf0VDT2RwaW74tRgjPmL1+xUNPY/JgZXi4DCN+UEDEHCoFVVCrDyhpUKk0i4E2J+rz8L1K5IsXRWjqHCNAYTiD+YkMKZWoIGeqEo/SBB2M0YJUp7KrNZtY0Un29hebOU5SVKhJI07zFZnxLCMqx0FC2DroNEM0IAjoCgDxLeQiHJ00gk9aLxidGIHSuVSueFgzUA1Roh3hWFwrkwvvnIiWMDJwjFkfi2WASle4YpVq9MpoVYzc8Ox+HQfmR4JR0p5YdiMbkYcDAcmalYcjlt1cYHBcPyC8SC6ugEA5YTN3JKcRSydxGzAOCE0w40dXPByTtmJWK7CcG8SG2OaQzaXFVOVzQ+JgitB6sx1x9VRyAurSSRE0QkAOwIVUK5IVczs5sybIHIoyyxYU4STspOfC4aLkzKkJkRyTBVxzyDHYehYhPPR3IGVTfEnV6EXZ560tL5+6jMknD6OdocVnHBJ+t5sdKSKZX8D56aHE8JsU8TxS/+/jrzqAiEZQMIAALuCIU2lGuj3BnGGCWXgB0gwCb5pMaZAJikLEhQoCIQHAdWFISDJHMc6MOIcS5YE+kRgIo4jdVyaiLTgWOqeQ06RDnTotyvHwT8kifiOj+U7s1yEnMhzXFZ2NNNrUQE8lCpXSicUIgxxi0oPCSViJSOALCegCsIFI+o4DIcCyOAwskfgLUk40UKFdlA3Jo5HLdVskjNOHyULSvH8RIJKKx6QmB0OjJtUdILNDyFxKPnqmiQXH7xoZCPS5H7yA+6/GwgEpLj5+ZJm+TIjQT4BOo0ywJRyvO8W+6SDZEJJTOkrK5zFiFhNXQK10dXzxI1c4SNJoG3lq+5dMUj7GOPQtgKpeLSf9v+91R4plSf0/UUCuqNc6vqo340l+nc/x/FStgKs74pZS+awQGfY8YdKI7Wq/qoXzsz8eKaNPpJjMQpybqEzBVc2JTjbDQ1C1doRKoXXiutKxpsK9TNoQKClQZ1V0zgt6FYHN6qAHAgDJJo2MiNlGBkBMWABHnAmLABZERKmC4Fy2lAIQgZTAjAEFEQyRCPKAQoyWjnIOELHpRwRgsJkBMjtBuhKhHASiHH6T8UpDC+ISNQUkfBhloW4//vSZOKB+C9+RmMvZGJqTeiADEOoZyX9EQ3l44H6PqFAkSFw7lGRo40MIGTYm6JLfZbM5MC6OjIVS+iEIjH8lRjE8Mkthul0VirQ8/EuaxdTgVyoUMVGGCvPzVVeDGMpFxFUxliN6ZB9TIUfxynwc8Y3S/lCRsnxEJFuMYgB+khOtGqA7TfOA5HiVLe0INPtz4vzQuSCHKiFEuEcnzRH4oHNoPBXKlsKmCT9pUfZzWLmTIgpdTIaWhnUaAO5budTIXCCgVYZhortDF0LajmZKmi2R0MVRXYOFhV7pRtVFcbkRTHoZWlyeZppU9icNylwWBaojYKRbSRthlZXBcXA5pI8M/HFhZ4exKLn2NjscjNNEVIuoaXFt//8o9IriJQqaQVP/hKkduopY+R7+MIW4jwa8X8lNZX3wPgQJZD/0Sv3N+qf+b2/mv5WiPHkCiXjS1d75scYIXL2PvGmSjaKIZ7/N38DIs8cJkF1EG45nnVS3Tkgk4I/u066l49ocfeL0HpvLuLnqiq+ohAADiqQoYDPYjBGzAj0U24RLVK4KBhGhAwEwwYmCoSAcVd5TVOpK9OtKyGmfwyyFwa9Wq47wqaPzEVK2hjoqZBqCo6gqeHoTCQtUDuHwRD8qMQYjyXwMDimCcWGSYEBgQg+MllRomVBQmDQLtUAYJEypsgwDRk71xOdJ2YhQbDMYBQ0ThfvNnBEFhHAekLAc4aijmwNihfVQuq0Tu4qH6FnjIiWYQyLjyGI2WdJQUYQSH5QeCIVKESMTEh0mUOsGlIB0gI00y5CZIVyEVl2PSAqoD7TI2hHDQfB4Qm1RlcoIXJaT6cSLsF0ShrBQiXUIGQySkU2yJA0QpLminbMTLACwAAAOAgvcg8tDraViOrbT1+Qnr9ZrfsjEeeQ7AqzdHPBOyO6IZ7asp304O9E6H/2KnR+P+PI/+trQi6TR6oMQ4ao6qT0ipNec4RO9Rd/JsGT86dKigp3VAIbU/oi6Mk60AmFuVAYhQAACGs6N6KN0lMclfcDLzDjznlxoOYlKCkgkWASAuggCT3MQCcFtWUJ8MyhWSklTWnhjrssNdyo2CZUBXrK1eKZM4xfWOIHqnYI7bL4fX80iPP/+9Jk3oEYFX5GS0xNomXtiJYUQ65mZfkQjT2bifg9IaAxF2EEUapoBrF7RadCVJMGEii2Baz3HWzHohaJUZbB6CwmWVwpCcHQfjOYwYY/ChMZ6oVyuTZN84GOGpDlThYoNVYoEUZlFe8QqU/CenW/TCIPtJnWm2ZWF/M1IFzOdEwzdLimk63IWTNMSE+h7fo5TnQgDrVLQl1aX6Rib1Ea5LkDc9DFSKHnAllUjnSGkHLqdiwlk2u0QbKdeFzVra/OlfmHepTpMkebczxlEgUyn0JIQ3GqukL1RfoRAQPCqNI9NggYjwFJlc9Q6hQDFuopTLhDKhboPIpKgF0NOdumr7SoCgEACsdGgGLHS+0YcE5NgldRQx+aOb1aIOdDBrfOIWlww2OFc2oJgb9BMYUcd3HQKrtBJOR6BZ5bzM8IRMhsLdBHileNV5Kooz5Xe7okKQ9RSxEQGjhAUFCh3+hkdlKIl4gxGqDmEVezIOSzjT4kKjHLGszaozrxAOHcJARFV+lraMqQgQqECJlQgAUGcRGbUmLTmOgAUsDgpKNRYTJKG4VB1wMAbZaKp428aNQ+CI6eBOlpiaiYKkuRum6ZSfZDltI4qOOzqBdoxDjyUybqvm4ysKOfLpqgu6pJQywki4MPY1a9bIKtgSH8c4/V5maX7GW5CViEulfpWKpk4oPr4shc2ok6KJck9LpEJGWZJVXJiuiHxgKVUIpIW01tYCkovYnOSSN6UyY5i6N84mEyU0dmkUSUWOwd7J4kDDGJExc6kU1hXrlaJIYH2Wzy7xRj1ZzJoUygcsiLRsuJWIMFUoJKlicOeSayJk/CEFUCao0SiQzXhaShsthr9uFna4SleOHRyECs7FI31pD1lpiaDZ1dsyTOqxSWkil1OTPzn7o5mxrFb9qa/SrZHDOHHvl8Dke3D1PyCUYXqmLCsX/zo4iLeRC+uxcH1AESogrP1MFxwvVFIERAuJg74zmpVulhJRGmAAAPo3MeLFxR7TIUCmHAGeQGGDhzsEFOw8g4YEICB6shCCQZNIQEMECqW08TTHAdZ4kqM4WYUKEEOL4WB4exWPE4r2RVKE/sISnFU7aToLEqzUNUhKXJsNRdXP9xOv/70mThgPeQfkdjT0xybq7IgAQjHmOx+RWNPY+KJD8hQGKb0dlEd2AQBwVFdITxJEfSgPINFZNJYTFuw5kweDQdjkfA4jLa8xN0qQ7R1WD6fFvaj8vOrHJiZjgXUxvqgyjHxYe4LzIcxxZOCWuFJmsqUBIVnJSRHaxeWTisRUCtSHLIiKUMuLENeewFchrCOVDVMfIQ4DkeuksDjyEZnBIODMwEVUkLbbooLyg0H8SFB4DA0MaDwqSEcdETAhlcQz0gQj2WiybmArPCU8ZFgkGiscNTFoez9BX8X1hOT4q4fQp8yWefj38y/1NX+5v+y7/w0NX73/2MS39DNrd12wuvy6MUegRUnHIiA/GUSShWx4whjPDQmT5B/o7pDqtzzGJnHm569/u3If5j2d70+xWsx5Xkrp0RRXFu5AKdCkzzjPkklLWGpySyMVJNND4QqJS5iKi8kkemorsmSqUDyBZ3leG3pAak7aoFGQlMwAAATaLLEj7Q0AgU2NQgCCBd0cIChhxg0o8amy6SPytqQZaBFNq6zEbV2ZoknY6FAcpmKRxlHWMdFsJ+0bF0pk8zI46zoQpFHEzPGNbTLASGaE5ZUzmdL9xOFPmyoUOhIe0P9OLgfzCSc22OIhrLJCTjFljXV1LFX1XFQ6XRGGnURshrXTkfSUvaObDkJxfaZRnywnHRoX/cXnmD+gkg+Ul33is8ZEsuFpckPjqx2fnrw4HR66fDoPFSKsaVG1RcUgqPVjMZye0YLo9rmSIYND84vKpqgnSx89dJaQ/sestXRS4TyBEdL6RjwhlepAOUFpkdj34sLBYITqAsOiKpaX/z7vq2w3JIsZWV8XNRc6pBlcUyfK+DGDoRCgjcGngxWojQxoKpAb7yvCEqfQsMyGTqJU6VVeCd38hu6cur26pOLq43VxeNubkme8Y6WiYr+XiMeS8umk0183YqsuSSOucnPhHQOyUwej1Y6nOyohTVOlZHKnM5b7NyQ/1S0rZkUeQwuCw7USEBoUzi8yIw1iYyIozMYSdEoI8JELArwXSUuErBH0LWivfA6YEOsHdFrzNHvltDAtLF4ZlTjXoYYuOiABEAc0A+Rh5NCAI38yQEEqCOARAL//vSZO2BOEp+xeMvZOB+b7hgIEaeYgn3FW1hh8oLvqGUgRqx5yIihCfHwrrlq56ENl6UkISY9WHAglocySTz0gEQ/wnHJ8JBwTEiWHjxGcoKovCRo9py3AU1piYmyp4qj60WSwgccIZMPjQkExstBWeQQvrCO8KwqiXH6WAu8VxrjK9y0JcnA6H7EJ0Sh6V+eHyh0cNQkxVzhvIjDgsWF3TFWtIRUT1QzwurDcdKECMdjYqkIQ4lw9LRHHlOkwenTmNObFcjE4anBDIJdNhwcMR5HUwcK9HiSaHThXZKq4eqDACRYgCkMebUJ8fHxNU0QrK05qDKKlICo3qhGhF728EhZz90TCnDk3S24M755DOkxDGV50cj5vcxkD3qc8W5iBkPTzFm7EXPzNb78Vnw5JsxM5NRiVUXjzTFOaJwSi5J2uu6ply4VTyS2GIWnZsaxRayRpMVlMbcvoy1Fu7n1LTrnj4tJWJs4Af4SyE3p0tkrIYFcHFQUuMgCKosyQ0DXw5BnQWIFsGiosMqdpijOlkuguVPaRvC0vOtOyt25DBzrsmm3akblzseiwoWJqiKtQhnUMxWJcBfMzwGT5OKhXMKloqLUZmPDgTJh7+AYA1SrLBSX7RJpIyxJcFFB5y0kLTlIZxpVhhB5YLKds3T0Ul5egLTpkSi3aBDgWl5IUDoxLr4jWJhVsSWKqDLhWuWHKpEhwOq1g5LCQhLCs2VHHR+OD0/HISCAyfCRDYlG56ysOnJJq8nGaQdJpCsYOnSKT1xovOaQkg5MUxZYHFGeQOn52bJE5fLy5CSm7h2xcloz1kT4zR2Ujy5i0wNsRc11Pbwytsv5+Fq+Pef9vjVuEuW1Rux8o+Q0vFdutjAzD2sWMpRzJAONoy+dY6+8R8JEPJ/6ybC3NFeQkXCMy5OQlhJkZk6Ywd6QsGjOhp0WNjKY19Xcd7aHCiAmDdTqADcERiLIAZMOoCJBGlk6iAiMNlnbAhg6WYmICYbOE1CoAXsLYgIMaiCag8YE0JMATTKEVeIqFuyyjZSwKMihyAJIiocpok6IQTwT96zl/cCDm03EnOslw8zRRTK/Q83WkyFySk1VKwF5VDYeB3BwHGMAQs/Tvz/+9Bk8AF4P35F21hi4n/PiGAtA35lFf0RDWHkwgg+IZSwmXi/Lk4w0QppGJ+S0viqZzJVyWUCjO4u6gfoMs3CZ6fpbGJFrUPLWgjtOdQFvQ50XNGdaPdRukcxsylLqeKsUzcomNDWU1korGCG5KJVGaxHGRUVOFuJIoIbotsVOnenFcvMsE+1OfRfGJZOQzDJQ9JF8nY1aXlWSJ+QyYtixS0QCnUxxocqWNCDnM9kWGRQE6d2TZ3WQS7WS/q6CyotHn+zoJTw1yvk0IUnDwcU4sSGmdyHbPxdledzepzfiRUPyzxi2q0/YCMgOj2cHsMt7PDZwQba5GOqXuacy3QwrNCCERohjdbKjm3MJZMS97kNtU9OICzHr7d3eei2i1wzbbUoyIw1pNd2R9zLNmVuwnEw+ejmnFTV9ie9O3tpxIrpzkUzKQ4nHqmbOu+lvkx4N7iL6eZOr+1uxd13G6cUlsoORGPMxnPXDsxGv3/r55yeZDET5+oRuSRpyAABXSBQgVOmjOA0WgNMUONSNMcjGRoY2RNeIaMLLEYRGtN4FB06GoKsf5a8CN448MsBgmNQlgnJwHYX6pnk7ZmRDDigJtVxmVYkNBqTKTaShaDcMgvhTmOSrcNyZFqDY5y5uiXKiHDPNILlXMFEStowwmxKxoSuQpfYVlJH87TjS5qdnVafVaMRM6dipiM8OdRNKzAUS5WFlS2jmnBY37a/XZZq9wcllcyJpLNC0ZklgklUoltpkxX6VDRBXj0w7APp+jRkwslk5kmGJkHdGiBRsvmqtaFNh3bRDqiD49Cs4Q3mjtCKAlVsxGnZVFRIbksupy4Vh1PVEemTcKhzSYsOhpPDNhGuZTHPIZyWEAtoiy1gAIBAADRKL3re+vap9Mwyx9Lqieh76mkuKWJSsi40T+jpIGBMLkVvsuxTZC+MxbUjvr93SKxLUYy+U6ioWkIHKSlufb7svSTM6h0om15GGCkWaArkwN56EReR6GcN38jfcQXmpvmqkpfDjQfIv6ussgBgImSgGAYAs8CBTnDxYOFWZNMLnnKGLEmiUZwRiXoYHGFRw8XgWeksm4767WDNySALvhYNItAAAg5D12i0Qj1wp4S5//vSZOYBOL1/RWNPZXByLriIHQPEY8n9Eo1l5cG9u+IUUIz5SqpRjxVk8ivoJ2Jc4TsK0fj1Kk9opTiVp/xGV0p9qxWIpGspdpEeb5biNLxwO15ULTehypM5uYjNP9bKXphgV7NtS3aIbtCFaqFhwRClY4byM1HnNppgmquzylQMKKhauVdlIaKTN/D8vyMhWOB4j2wuShXm7KEqlOxoKVMOyjgNbxOqBPGekNNmTRdOEedHplXPzmUSjTURaTp1v1OpXypftyfQiG9fm/AZbNaQPQ7Ybm4uCcVKzkzF48FS2E1b4OWuKpGhl2eqmP5zkP909bVwc7Wr3FU6Uq02xishoq9JkAm6t2BAwHR7ah2zJTyp88rck2RmKVMhbOKYmMGz1RcWTQzZSNO/UYiivkbTyzUDosziPnwr2PGhCUyF501/L8YrX7ihMx+a+Do0VgcQXtTh8Lap8RjnAcSkqcNQZUyIv4XDSAz1SR+qLJVCAAIATwMNJMxRw9cIVNBUzSA1A4ZwGGI1ygMABAIBjIiHAX6Jh2A46JKI6a6639UHcNgjFlD1N5lWaApp0pLQNZfbCNu+z+MuhDTK064dX/ACaa7n1g5zGhM4a9GYKbsxGxLHAcPNtaRkDcHmg5a1O/1KtN3GWQEuyKw7AFx5ZI2CUPTRz7wMEeumnVHIKhqH1yRp+YMjEC0FJPu5EGsQ66reQG2GOunBMtkydE/E3TgGJuxYXXWabDUQcRr7Mak8tSamNPg+0beCeZZLs7qvnnijWLkzFoZbxydQ5DTzzLDIFgh6pbSu9B7pt1h2G4q7k/QyB6ohDcgXq8kSg1sMfwdx8Xcc+U0szALYMYD7VjXJqYnXabpA0YtwXBtiKV6CQxSRxpyItRuDE5FGZdC67gSaVvo/LidltZAAABwCABxhBjyYDAZMhGN4gxAWHDnP2d46wp/P6O+rfXmeQrx2CGQBcBDh3atG1TtzNKzEIeaX/q5aqrIcjKd5HMdCkcoVjPkf////1TwdUDP///B5ERnsZHKZTMyvsZWlVrsUPXEXAAAAQ0IEIJLSzesKhTmpaZmJ55nRTLGBQ6mfAemYoWnDajn9KuHK9ZGM60mNBVjBtGf/+9Jk6gAJ137ELWcAAGcvWKmjCABycg0tWd2ACgYeZJ8ekACw0G3bLGF1SmQBFGWpgneUxxSIb6CndaZ4RgbYrF0TpmwmTDrk8wpXOKKTCAEywuNOOjGwczYgAwwXoCoaZABixQYwQg4uGA5CFahkAQOgIsBthLZmBHZEaFqgYJggCMJAzJQFs6v1ZBITMXExITU0DBtHwwEKJhgwMGAwuYaJLZSHaaYEFqNMAaxZUZRMW4W8b1p69gKOGMhoGEVvmFBaEx6GUCwepy0hoDW1GC/6taJ7Uow276Q4DAUSDCYzS5EgZH9FJ2lUZ94E0oLoX0vP1KSyC1IGLiNo96qqC7Tk+4ff2BUd2GkICW4LsqmbpFF7PO40TpIbbaffx2pRJXlU/BzZnEjbtuXIJmJv/L3QjC9FBEclmoqw0pQ3Au+mAoKs5fqxVrw9GHLjMolrsTVNGJ2VuxAlrCp3Lf//f/91c8////////52du1rdSnq/UuXdY67////////asDNg0TRIFAAEIHAQCAQCAXY+0mEMSahVb8SyDb7M/RsWuziAT2OhhienpxoX2e3e3818Mh7y14w+RR7FIiEpJAEhBdrMpRmSDhUn/1RBux7BtnIbMLoxWyj9efvfDzlvntf0m2eQESBja/huOSIQOT3aEM0KBN3am/i9by6F/qMSTAgLgL/5W0YAAAAVwlAmmwRxswcW6HMqxqKqwEM6DQWsxwtBVuaMmDRGFE4zU/MXfTgkEvYYWeZMOIi5nGbDBwWbpeZFkY0UHZVdvEHCxIMAAJgRpM5AgsSGJsjSQaFu4HDFcmLCqHOY1FmamwVCGrJAEAWiUVGhyqCwydrqN4xEu+1lCS20OigVBxxHoUkvlDJC4RAC5SZcUbhAMFtIYwnvVYuiMGBltJvsYYMpNJ8uSTAWTvUuhFlaC43NYavRHFYZLp/cn0dpeTtQiOvg0rFXF+VPA1trMSZ6uaBlxp0UlIy5wl9q9d6XvtDzYn3nnJUaVpVvVelLDjwsSawj63NW1zpQnwi4wbq7oBcl3FiNTQaTrZWtxYFsDTl3NzZlfQYepEyAFG2fqCqlWAX0ylGKG3iRSbeB1AXBedB5tn7L+0sVf/70mSehvoFaMk/b0AAWObpM+WgACkR5xhN5fHBUJlkAJKZ6MhcDs0AAAAExQzqfqauNyKQbASggEQNRzC4hmhgUKKi/nzR7B1JDj//Gt+urMXy1rPDmir4OGQMfxQ8aeJswsYtSKCcoXMEM38n1MHVusNTt6numwkmv0P9fX/+gBjj8gE6xoLOBj8yIuMu4TTgw1A9OehgafmKZZoDCZGAGrgRkzQNNZpacaDHmri4k5iNJMLLjydOak8CzHUEQQVWNcgQIAuIvsEVmmCKihFAREDRjHOHrSj8SWAWRkCBgKKqFi4RZ5mjQ0gzBgHjkc0Fl8I/NCYeXAWGh91U0S+y6TYhS4V0yxJ5zJSygBRJzRlZbtsrQ5GKAXdBxqMSZoqEhqsKhsj8s0yiFlLUUqS2BrCQgXiZJAhwbRpnCCCbzsq6jktDBOgv5lBfEGLsvKNcKgxwmsn6czmcxKVIqTJeMSvIK5qdHJ4ghcTKIa+gZYyhTxMDzUJOSSQZJ21fdHBqVLnUkChnFcLEfKZUSLzVKltQxuPs9iFI1ub35JENhxjgJuP9QHGq2RCjBLwfhcRbJHksf5vndKf9/H/pAeapr//++8vw3hhEWXthPrkjhDvLskq7ojMY2AwdKWarUlDoqJMoivjbbYzHVpu5dwWi5jSVHKbKg6TeyEhL/hRLdOglYoQCJk8LHgg4FUEhMVGiBA9jhZ7NPo0p/bQqjAKItGVWZl5saKXHA2JvGsbR8mk2J/Dmbg9mFlpvwIaCyGjmJkACY2nmlB5gQSZcPkgsEK4GGAwjYEK2DhOIFiGsaDAtZAA64BMLLCAslT7NwFYUelNy2JIdpiWzWVZ0LSsgycMyzeTOgXGZGzlkkDAAZQFdFQvaX1U6jbWmQpbJLtuOLMoo6WyZs3Z+GktxaY12iehcYUGqFxGUtfUCZMiN8Ao2spCtJyZIipwIgvaYOEQM0iSl5F6oArkOQkWc/j1BihgwFaixJTcJUrnIbwk4mpdEuY5d4KsOk4nZsK1oPZXEJPo5ylaFMhx6H4UIlWJkUikOpEEoOc2LHMXJIJI/EASpOG4eRdEck0YhrUimpDyguYilPUcDaQUsb47EKMcyVYXh//vSZJMEGot+xbN4fHBcrwjoGGKOKxn9DA5h8cE6hONgMIjQhajpbyrLcjnjLFUELKObprKv4eLE+eqcNvU2o0OPAiaUWGuZKby/veN192AABkAC1jkzFg6RRFiXnDkiXjf++5/3//1Lobvr/afFJtja09SDCo1shIq6GCUMqrFXUEVWauXX9P0dlo6o/5Pan5vpUnvt9tP3r//15mWDnKd+RuUy8aTh1BrKjzFymMFCMyEBDMDrNdAkyUXziQZNEHEwKHBYIGDByGBcmGJMBxQFGLgkAA2BiKYIFxiUEAIUjAJO9ibSIhDIaevZYYe2K2UsAUjW8GAbQt2vhRxoK8neTFEwmhagIXGkE4AoQlQi6nIlnBjoLyg9YyE+wqFbKgxbdIRB1PdWRSBVDDbLn4dMmKxdk7JFlsaX+m46bblv3hQmJFNZXJHl1r7pmVMbpgkoiaKDHHYnSjF7GJsFOVqJPtD2TJ7ltQklo+jGQZnPgih0HIyFxPhBivF/K5Al9LU0D+JgqWE7FpwJ6d5dGYdyNNmGjh4ncqFQhB0FxMdiNBlP4vKEt7xC0OUIwWEsT90oFezJZiQhBopTk7QCEOjEJ0U0pxpzBDnZ/CvpA6uOUeR8qt25H2fsyQS52DV2fjhKc68zXQB/hFKZXpkaNJjynQfJTVJnsQ0xF8c1z1Qss2udpBAgACTB6iVU010B7xQBDSj07xRAsIEOJUGQmcbY/eo8gu4UIoLKr6f0vYSev7mteZcAlFdqH+Ya1yhVWuSY1q3iwcFxGkqeCdDIiSTSsnUxzBM1wTRKM4QMM2SzNEwgfDGkE3CLM8WjTR0zkMMDAgMGmsFJliqCokwsbMELG1M4FAUUJAGCHqnBgAWJyTYKrkphxpuxWMQlihrA0J7ASDJQpABVhaVvi7iYCeS/BAUZNH3JKDKRCol3BZq1mngwKI7C2wOokyaCPhNtcXYXJhuJrjLNMgj/q/VmaqypVSEIIUSkuBHCNj0X9eBSRcZSlgMJT8CHFeOAj1WSs5x1hxi5hEBmuYXpyiyFuVAcZXFjLCoA6hIR0D9Fdwc4X6lJmjz/O8v4nZOzEOosI5XQoSvkFJDeHapCUltIcNuBBFf/+9JkeAc7WH/CA3h84FSleKUMIm6rYf0KrmXrwW00YuBQivlN+OTwbRY0SO5ILBzCVK84lGLASURkzYw4BukKE/amYlCaXJdyOL2X0Ik/g02txDlOAFchIN8bh/qM7idm8HgFM/6cW0y1nkNw9iHj/ME3y+D2FhUJ0JtrFuY0iYiNUJcDQL8IOfg31Ig08cq6P2Q7ycksMQsZNC8oqBcDAAOLecsp56G3pRYYzRyF9Q5G5SsOqVmJH0qvm7F1EmwosgL2nm5VArgaIFRwuYbpi5ccuKx73qIMtxg9OspJBkRPE6ElHBFRwCLFJQ6XQEwnkBdpJj8qGGEGD1cZBLxiEMmFxeY4E5jACCFIGOgEIwYBgzD41uZyJgFjorCB2IWZMNBL9JpBYkCb8uDFgSCs8dDIiBkIKhKBsiFA1NWstsv9ral72IvFqG+ZQXVLrMtW2uZspMUdgfwKMdLcK4EHE1BOgfm4kY8hAx6QtRLw6jlAZlgWMIGHEBMIgZh/BsEkL0eosRiBsD4JcCFF3IeBZNcfCYOc/nxYYZ9KdBEkHCMQiECJ4dp1r7pbTwl2FTmufoeTfIqGUsd0ZaYS8Q3BNT1GGzm+Qo1WBHk0gE3RAmSEnYpmU0ThKlcNptCfthpqwu8xbS4H8IuXRhOy4trKjWNsKcmZ5LY3jmLmlVYfZIS3tJ8qVzQLOuifkkQ86XMP9YLC+PUzB2CQs6PLyhA3DJMVIhTHcIwYqQCdP8/YB/vSYESXFyICZxbivSQ+2hhO0qBJz1NNZPFuJSfa+5ABAIw0GOVWTspfGNTuqsiNTbPGnZx5EYD6BdEZChIQM0xTpEmZskYTLUuZEJy1IHKiFcZ88ez9kZLPOUjPYJ3u+5567FrpapC9u9QUHxTuznZY/yK/8n4+Sp4wAAIEAA93NNcT9QYkWjUxo1+bKjAcAWmvpJqYCZ06GEqphagbMKGAII+GbmACUBgSE9UhACRMtAHh0gkwH7Yc5aJ6zB0BlqqcXXAn+/SCVVNir7rqSJLjLHRiaVpliu2WtsuUQiCgK9nYUyVja8gaCin9WDXYu0+yGSuRGDmFuNACkvgvjxOM9xiBxGgS0oVKJYiTAUwuh+pwg//70mRNAZrpfsLDeXtyXaH4tRgjNGol9xUO6euJazyjVPCKOJKySmGMdrQ4YxhFINwsY/WsmbGkHM4g0E+aAuIts5PTtUIfZysJ+h0IUMNbJih53Px68jwXRfDQMsNwbhpnK2H2pjeHsQsqBMxuMScPwLo2ysJwlpkkWEpCErsfhzFjLuQgoz2N5OwDiNZDSUk1MFGi4OUMhA7FAdaGBKRmE+JSMk2Vl0SMTRBn+nTNJSLI9X9qUvTkf0I+kOJ4L4wMGyLq2oYrzkLAMQ8k8JojyTiyoeY5ulyNZ0OQ6TTUhPS4PjUXhQAUI2RwAQNZTbOjJ5G9Pt7g/dry/+v/9GV8mxo5i8UN3C16n9E//2t/p8v4L/caf5Z90kHcA2dnL8PI/wTNSdHyatCpNWZ+9cTFCiwa1uJkIH7QO3h9/sfP7n6XOAEAAXwZkhIZjKEYlrGcjiQdeCkbXk6asMYQJuaSMcYjGkZWlKZAAEf+gaiWZUqY0uYokYPeajea+Aa6eZmwZt+DBhAPELAybcwbNFIxR0yLgGjzDDDLjTLEDbkzXhQMwJgS7F4IBxAGEAcvsIUBOgkCODSE1uqjtdK8NrI+ixxh8JUuJb00q3FHi2mkQUd4YAowKAxzlOM+jyRZ6i5IShRzocPQcZehSDsNRRm6rkNczhUyJ2VaMdjcTqHn4ZqohntdGKovzc5oSdbUwlyU5cUKj4bU61KI3YJvKt5O4xE2vbQpUoOZTQVIhkdRrx3N6QX2dWNiHKnSFn+hKrgLtJWPxTwkgn1AaTEZLpdKVSKlWnIr1TGZ2MunTLCijlkPSCZsBQtBzKSEeTWqGpDrqxSrtMnM+YDLYl6ZsjvFIoWA7FlyvZ0rG9wUqfP19DuuHgMoOEKAmRrDUVaggpyNfVoOc++bVw5kWi0rLKrVbPm5YOtdcvGQO0MyK61pvSy2ufcvqmltKz9a7u9N7Mmqur3autl/2Rszc8s+lGSmp3YRNQ9WabVcVDIvQQ+UVQYIAcKeZlNhGaAMbwl5vZgmglWaOQpjMIGKyAY8E5/3AcoB3H3URHgl0UCA5yRL2B1rIS+Zewv8JDIaN6oOhUnGwVPUDAq6EYs++DEELIoW1fhY//vSZCmBCfx+xCuZenJQJLj5GCNuKI35Dq3h68lsgqMgkJgBzJTrsISMUHKlS5n4slOAylxFJItyG/ARpXHmTZDkUb5OkIQ4xCoWD9MYvsAsaoNA8y5Isekdp/EZZnJXmwoSxvF9JuJ3MaTTKcZWt2ozeV6RPB+umGY+F0T1OoxJotNp1WJpKOslqc6mdK9Cm03oyNOZUMsI5FOnFfZDjVU7k4SqJzNRhmfSMB4yq16aZyKhyam9HHMxrZxqxhNtUH+wtbGnZoifgFjPJQJuZkOc7Cfm2oTtW0QplOkC6l6Os3UPOzUJAtRC1ZgxVOfLOq+a64L43JMwi4VQlCWIg53nsnIKEk+ZzKPRhSbctw1QAJRGtVQCUiRAKOUt981Yb1J8ome3ZkYoLuEBlQbQTo6HbZToxo87BIq1EXUmhOOtxd2gxajFeUW6GdD8xpWl799l6Qy9B97U97FnI2jGHVgIAb/sHEjZnBaDlwy4EFUUyZmMGDE8TGzUEBY0mm8oX0ncGTESxRywJUivkIA3FlSAhCtird7ymJblCW8alqPqNzPmhochbawymCDyell8G5R1Y0gaEqs6iOCGwr6HiYFiHcdAZgMxClyJuZYupbC5ZJyXcfJkkzQ03nljURhDzmO0WI2B+MiEMRhk5Q1WLsh9FlOoUTBFHuLodx/oQfhzMKHE2Rh0kkbXiswbTSii+H+N4rnOCWDBNiSuB4qpkNwvxop0uIwUojTyjIM6VfHJYpDpKdDkg2qMv2BzLBgSwT9ZDFWzJNZToxgL6ZcyrLcXAvk4wSwH3EJoZyyfJ0KAelOOD1z0WZnrk5VcO2OmCaWPxvXCjiE1RBednA2qtrPU3SfmukCtJgVaGmSpTyPBjJMpBgEoNVAjvUascJT3RqUWIxIUE0V+ETQkGfJIrvffEluNe19VuavKXvT+BT7KOB1udq7z7pwq2WAtVnl+/N+f1ddV27Vh0kqm3zE8UBkjr9qKXDz//f7Edfvcn/n/H9d51td//1/df/nnV+NTqgANAAA3jQxhM1xszdsLkDSh01RGlMGiJEhpGYzAxSEIQ8OYpUAVqrpjI9KVIRQpQNVyK6cihtx5ERozASJygqKDSEr/+9JkIYO5rH5EQ1h6cmYOGJAMQ+Rktf0SjOHmwX694iAwiTkYSisqrJ1evOr0CkjmQtTAqUoZQ/QeZpI08zdOA6llBlwXZ6ltNISguy28VB4kqSiUJmV5RF3N5wLiMg9W82z5E8UQ6FlSGccSFF/J+nB0McMyDRY3ZmnO+L64p1Tm6WE/ILewqxDlCbh9LiIsMaEow6lIVw45jeO843xpRj9eullXssxumifZ8ukPbVpTqg60PbkoYrirkG+aWdjOmdmSpfi5Q1OxYQtiTijVUE4FQ0NyZZVyfwwkEa6JSRBGU7j/LN+f7F2yxzHMdI3ohqqYx2ntRqIc9UhCNnbAjLtobFuM4OJjMRgnAfSdmJ/GV8NanrgMOoI6RBj/+Hwv/hEUkY/Mq7OzNVhNmYTkvOW5ZUZuzd3zO26BSPro6/8rW55MRkUMo5T/XJmLiOTbWgqXGuepH0zMZqqL61ZbhqVjxaVsrncO1JydLTlhpIMwWPl7GlHgOvOdmPAAChAKJZkFnHQeKh9sAYY3bgz882LWg5gAWGIAeRQS20NgIZMjsHOXVKEyRZAFEXY2SfIXBOxTOSGiTMi4UaBNYX5ZIIxFYOc0JEWSoylIRBMC4l1VMI2IiBUpI3iVUiEK9zQ9iP4laEoYrUOmT6FRGA3mQ62RRKl82MynXkwpVhDlGdjzKsTTYf6vOiiHl+cl+AwnOqm95HOk/pjxX3lZVEwPEmpUiepf1pcsyqgN75+ShRrjKOQ+rO/N1lpI1HkooLkdLxjPJ5d8oEaqGBbPNpZDzcGY3lg6D0R6oWS4sx7sLtHJksC+XtSbZ1W2Jw004qWI7oi6clA4MTmT85Y7ehpxK1ofQWdgOpplZSGqxDnE/joY3SggtihYXrklznVhYUJYnweBhoKAmAmDaTIj9+zIP0cmxQm/NFGTKiGSs62QUpht6Nl6Du/7ekq52NG36ODsxjzvdikhVUqTWs33xPSO1tXv0ZQzKt/I3FHX3ITlBcIc/VGXnK4joojQh30Kz0EuXgOjEwA+hkxBoQvHi0baEMnq6aKJumDooEBHhCIN6UtwYYmOyoeYlWJAiHkoVCscmwubNFJ06B4ptSFjOSdKsK03uf/70mQhAbjcf0VDWXhgXu3YqAQivmL1+xVsvZOBjr1iVGCNe57v1Uq1SpmtwJUdTIPIsZyE7SInB4sXSCIN1mViwnWM7j0NNCUAzm0dkJUItPtSaXBfHZ6QISgZoJY4C4VzGzwDMeNZ+uJqE5duU6LQ6Tbp2qkio7vEw2rtN4Lc5s6GI2HRicJ2KHk5HcRvUCQcG9KoejYC+wqY+LopRn+4McrjHbmtGKs5Jbv0OclfphS6ROd6xqlOL8q0srbtQNjhBgukmwKdDop7PE/Q9U3OPip+MUzIpWxpJWsnmo1IZKn05tTdFWz/cjROp4sv1IyVaz0ZWKExO3SjZoNwAaUAAJgE27mjQiiSYW4rLLL14QzIwyzISNKRmfsjM0ZFCAzwu6KCNuiwmz69jniUkIOh5YpxyNwVxlNmAfiIgM6y8ztIxlXkI+9DE7BXdcydlOEdtGb6XvEP/4NCn0UUqmmEBYY6ZTKZBghnmBRU3LA4kxASAgBcnoYJVkgU2WWT9R5WFXspovZ176NaIh/nKjliAj4x7ptPjePzKrKZOnmcxd3ahNVOmMpz+NlpQ0nKHJBrFzKVFII6EMOVUxTDP1Djqb2ZOsJNUmuDKVSEk1V5+mcxqE/m2O8LitHIzNljk4MCUWSeBc+PDm6ApOT9gg3RiCYq0EvH8FCYQ6DiXy4fibAb3sPSzRCF5AqMSJh4pWFpHQ8LD/GaIgGIiO5GZIQfFsfTMc4iouYuiWkwnefCMFDrbTA9Gw0LlouRj4WTEcR9LRMJYlmaIsjrREHB0dmEmjA4IZTUJy0hn7BgfCOZNoQ9OFMv8sZEtxXc6IS4zOjHD1pQ6Z9XD58llLuRfn5tTw9yWzZNTY7DQuH85VKkqlOcz6ZvCtun0I6kWpkVUvXkLnFsdPL69Y9qWXp5VE5C/P4U3rGHb89HNagintlkckY1ELFNl4U2ifYnePNpZCz4biChJojFZLTlRHAHsZAhIpiYI2FEBic4BQIAYI6TAkQZgALHL0hYpJlbSHNTpFNdVGsCsK7bgiKCY1AaXmxYJotLQHCIOowAGUkIJEPygccLiwWDxgvj0pFxMUCGtI44AwJxgSTIsFM7LaowS6bE8tic//vSZDYBODt+RdtZYPJqLwiVGCMuYPn9F209j4GSPiIUoIm5oWmJTGANCilVVUrPgGkkEtXRcesPvD+mTGj1lZNWLywPdUxzAkcLZnZUpiKThsfJ2G30M4Pj8Tlxu42sglUJ54kSF1DVNZEsTMmR4vISglR3LRno8FYQy8k4cWD9lMeUNVzpfKpAXJCkNbB2V8P1xmdj0wWYkrOFOSYIDp+yPqy6KMirilEw+jagSrTHUIzIqCWCSkVOMLKPMuSgZAAPfti0jqzrI8oETVds5MzjNlZ/n7Mx1dpyIRqZae5pISmTMp5qd2Y0v5H9sL81/Pl2hoTlIhm1NH3CEkS11kY4pXf2PW5S8BflGJCOA7NRkXmR/H0sdjWanwGtMijmnf3K6jPcfiTvs0FOtkID4IQJMQuNAMAyedHSi6TCBigwVRJlQYQdApJNFHlE0IUCZlyOYZli5HecMSC4PF50pmklanHGW88UuzOorAl19jVpoGREamNeRYkaeWzpVp5EtO6OypTKY1HddpJdMwbVIokB8bD8mw1qUIhHPxJSHayiAdm5EJxWXqXFGQOnRThJK/kBCeL84kOXy2oVHrXHjzJTJgnidCckEwbrE5sauEyLr7602NjBtYUyUR0pXHbkq5+zzo4L2JFzSxDOTs0aXEpALI4BWc2UlVUOBYWqTYxSlRqEzH5KZCBHqu1VpxUf2OImjmanFC8lD0tLmR4eOy+rbLZ9xwXkBs8IOHEReO34kIhudaxznWqjn1sS1MELQRSaWMwEnGU8Tb/HoMZWelETQjLRX1KXyFazq8krKCs7sX1JiSlXkfujK004J3qQjAtiHbo3eIaJkCGpP6IGXhEfyBw1mX1Ur1u0MMhqjVcE3U9odFULSyNlyAAAaFd0YGGEAg4aFmRzqGoEcgIy0FADmDEJg0MAA4uW+aHWUSLTJIsFeVskGQA/7sp2OyAgKg34dw7JL7oRlFeVSnQNjhIpEqzjCAsHAtjgaiSVByTrUYjncITBkJPRGSY9Vj6STU8jWnx9cpOFLFiQ1PDx0xaeMoyZCeIZeSlmTpWvL8Gkle6y88qOlCUzhMqHZwpXOqkqw5qXGIOwSjI4XlpDOEWFfCb/+9JkVwE4E39GY1lhcGQveKgcIp5gsfsXbL2RQbg9YUCwjNhU5qbeZvupdPDwrECxlymDz46I52UVpaSlRLsbJzZQsPL3JsNDsydMUBL8JRXiQyeHUSlJiMS2BmWyoTTtm9ELD8eXiSfHqw/OGPfWKTqrC50urqxgE0IAAJK7Jq1HZaN10xKVqc5/ygaUlNGYCfRyhx7QnEAQm4GjiKG04mA1IikyEt/Wc0y9EKaljnqvGqtK3KbbuS5iPcZ33lTjztcErA0JZFMo1tLZ2Bu9VZvBZjKwMypYGVF1gIpuJEYPQEFIHEAhNABJhwgrYW0UoOiQ1x0XC5rGi0goEnqKEJHrrbd1R5otaT5gMCuMlIGnM/XA/z3L+c7g60wotyMIusN4kmFtXK5gL6wbpyk3lZlDD3FVsZXOC0XrIJNK6UtEUSnhBKZ0FI5QBQXnYi+PKggKjQfk61SSj4hnEtLJdhPyfBCSEgnll4kWbpLl2i6TE6pOoN09i8ubVyX2R1RwkmJDX0WDmJZbLkbKY9OFCw7XUEJEvqZjiYFLn/Q0i66QtCQ/VCcIBsQkJSFTZzV0eU7x48VzOh6ay6OD5ndHjxcTlep+bHZ2kPC4Vycd2MjxteUiQoSnBbeOikuO1TPKWhnKSF6+V27X7LfoX/+iPs/J3UwQ21y+Mc4R73jBr0Rs+CCiWATwEgq9uiBO8o3DNfQBqZB+gv0OMD62isGoD9ZTP6HrFXECf+CV/jGA6lDfLpfwLT/Ib+yg1+N+8bA/zy6vRY3GOfrTyGUGIBIqEeVVABsY2iNBnyicZYGmUNsRMaHNUTMmIFAwwArBw1Kh0WkqWKaLsYHFl2wl3GMuq6P5FqJLnezmGvi4l9yoz2OQ5YKkeQ5k1lDieHEoiuKCdUtUMyy5MCs2/cE8sllsqEwSD4kpztgyEReTfZgQkhghDQUGLk42xs9Jxm64n0kpFjqEuQIYy0bl5CunKTDS2Bm5foOkKkSUG5/VQkSFapUTVdKrXF+A3UPnjKVT55ioiE1w6NiQvHRckXvwCgeKmZcTDs+hxCUsXsulleoPw6HhwttlwkdEnXxEQojz0RAMSSViyiOR+pMFTM+TEkvuPFY5Lf/70mR6AZgvf0XDT2TEaG8YaTSibmD5/ReNYYnBrD3hQJCIaKwS0JUVzdEyQXR9U/KpcSG7uAAEiQAACmkapO5iyLNUmwidsg5WRlN+cWHiwoOFGGKJFUnRPIx1AjyJ5G6GfFKf3d0gnoLezLQaqCXjP4R5fQ/0HH3ftUmpiNUcD/+hGb1GG9dKFB0CL6GCv6ttk9T/vd3fVyvBjYiMQitaySwBXMFk4OZmaBF4RJYjsZ4wY8kaEcK3QpESznoWarK+yVLYHRxUXiauaR5XXZC1mzFKdfLqwCymQNYh6Gn6hhXDJqpUZLJLFqWpIHUe1b4/qRu86vBIRBQoLCIzTqTxqMSScjKg7nxOJRXTj2ekBOFAkNlEt6UzzyGfsldYemZQ1BL6+I2TvHJTUoqNP+muuHQ4YQ8VPuqzplWiOhIVXYheoX0ghWisO6p1qA9OBwPT9MSH3uIqzjvybRofoaHi+AnnylWeJyCsWOHhOVL1Y9PkZecj2fLdLpbM/QW5hLo6CMVDR1IaUJZWMmzBDG5ebK495iuNW+JJiSSkgcekLmbjuft3CaB9Ky0pTNE1IIczkmneFaVmc4xqqvcOfBB1BqlRyQYq6t/wmBDmwTIShqsUrwawo/9HdAYvIQAamhpGUhNkU7VK61Uj+chGsch0zupfhRqFhnoVyfNHI0GLq39RhEOTgxSoGjkcz52MVIoNrRto8AbwqL5j6nfYCX0rBW4xgTJOM4cIaFjxotGsxwS5Q4AKDk1LIBYDnJUMAaI4hCFYQ1LNxfJ0yb0EWtMIlIqw0nOp+tiJRrkytx/nD3OK8R63FQ45Y7PR7c9GJTMyuZnZ7RtSMy4T7cwQVSq2hdNJcXsdHpZTrL1RKqygW1Gr5meHiIuXzLFbIURXvmuV85N8zK1x36vcYd2WCpUzDiNzhFmrPDcVcy2a21yjRoitvDwsOeldAg4cZOzsDK0SsbxhTyngNzZvS7irbChOI8FtZWRLaUbBHuxMbYgFFXbA5q+seRcObOoX6chJ1rqq218/a5q3RjxJK1QJ/quE9spX7GwvHBbiLMlABwAAAeTJru9enf/ds7F0cQKaripBB9Qd1E6lc7PkKlV5R7hkTmjl//vQZJmACFx/Rl1l4ABmrMhooxQAM3nnMfnOAAJEHyS3EsAAqHR3+hfYkSZA6f0u9TWf+g+5xTD5RNYn8JkYh+ihwfyigwN3iIbIwk3+Qf/9Ld//EwQrJ8XiVC2mHdtYnPkWqQSY2hQYMIOIYCgdjo6X7AoaGHwkYmDhik5mAyIcGY5mYgGOg8brTJrgXGvDkYNMhggJhABMoos0qUzGwgNVowkB4WBhllJmv0qLAk0YVQUDCYGpRGOxCYxRJsFXmFzCZhCxkZXGCAEJBp9kRDRo9NCFIODLBjKpuOGLkSJhhoXgITt1RrLXz5jwoGSBgBhIYvEI8GjC4wMaHMeAgjCRk0fSyhnpOj284QDAUMy6jBDBoTMKgkIWZkUOAY0oBEEJgkQISF8BQBMEb97EUxIPmCQuYTBoQEyISlt24A4hlt06xQOq2mGwsHAqPLMuJ0uA9kXgiGQACjBgSDAgpNdjkAILlx4uj6UAYiCi+xgAl4VMlPvq7sicKGHFhuUvU4jwystAuR410JTpBrCRBejlwYmWKg4GA1dBfAwCBmipALwXSzmRPe2Frz3uPArtRS4x1rbkP1B/JG/7TlLGcQyzZsM2/FIytwG7qCKYqnrNZdFZUXVsV04K6cn5eTv91/483v//n/////////3DDLWsdcwulyh38FoufFCyHgCAUAgUCAYCAEBAIBE7qOw8JUB9PBIlrCN6hNNNfylQIENlfe+HCP7vNbfozmKrmHZ4SJo32TSa8snrpjzrv0X8uWHyETg835vLHUfjcq9hbdw/aSO0imL5maUl2YOntqcIk8DDAXHIgOMEjBQTjRgOmRbaWODjYkklIrsMIrrBcpe5SXqV+9lC1rLflCEMryRLoSEAAAAABr8yUQNCjzECAWCzC08wkxOhYjVjUzgVC5sBQMECZhxwZAMGJEhgxSCjhhhuo+BRQ0IgMzODBTQw84BCGCG8ycbLCkdvKmF4RgByVOg81ONXajAGAAGBhwAd8cIMGfzIAYzWGkzlmNtUBJWS4IAwuUYsPBwSGI4GUTBgYEEptDmgOBBgUI4OLhERmMkZrgcZoBNzMRIzMy8xAaAomOLRVBghkMFEAQnGPG4IHf/70mRZgAusbEtOb2AAeGeJaMMwACWxmT/5vQABwZ7lIwbAADCh8ylSMpETBQEBAAGADAgcSCGMtcMGIDABEwovMiDwwzROC4cZYClsQQDQMRAcUROQ3XmW/VXTrZwl3YiIsKjgcLFZVEDBQRZbBGAvoXlMcBzCgRHlx2IQl96RyFAE9JmtU0+79TOChqtqVLOmJLGfyvLpqKNwW80BaLySZ/5dNwNTvxD8om4nF4b72eefkvoaSJQNE4nYqxCmt0k7HZRFZZUpL32qkRuy2YmKbGns4Z1+b3/8/t8l/WIA3CTCf+d5EAJ0AAAABMQBiDy3ju1Y3ffN8+DevF5wflLoAetizmVzb1oeOZ0/6kExGC88gla06iOXk8aEUxXGtZMi68dFwotSwivnNYprFMSA7rMU8srfM+/y2zFu/SZ+YgXLninzAdfmU/+v+134eIsCZ84Gf6wOehVpD+tnJRMw7u7GRAAAAAgAFGOfbfGRGByJcdSymKl5hRqMmxsQCokZoYGyigsPGGipmpiZSSmjlYFRTEFEZKjWtTp1wcXCpszBMOOAZ2PJCQCYou74WGwPASQjsmxZm3Ug5WY5qY0UBg5mF6Cq7GtsDVKZkeDjYYMUDLvAIGQBy6iOUUFQCOSwSt4cbgtMNmyjCabOWdN0SRaOxdJRASpYiHALM3PzWsylXbJ2JsGa6zQGBVJNXZinY/6cCP8jgakR2UhHygczZ7GdwPEFjuEttqFPAMZkt1AamM8kGKUsTg+MUYNCqfhxi7X46/8WfyD6ZDN00EMgjV5w5TPyqaYUr9uEvdKmicgiUvvyWvjytlan8bszbr451asVvdpKWX1a9BKdUtW/aq1a3Zm/hredmxNAAAJgAAAQkjp+toqsQk1m9M/OS3MiufhHwviOUiKQS99ZBrdblp3E6uZiIBtdeVEgN4LtZkBZJxxeqYQQqSjyoqc7j58P69YSKLTuiY+Ni81TvVP7Trq8c7LdazsdeUvxCAslV9zuvfs9/HMcbHJMMoQEAAABjvQAMeFmilpjgA81M4VHmJAhgMEBTHgDPkkShYYZMMKhQEsOA0KAoWpcueDkmbkSw2uFAAQYZBpyrGO+ZhJ8WixI//vSZCOCKgp6x89rIABNxalM4JgAJYnzHW1lM8lrFiRkEZoIVoPZcJwMxYDJDDaCUITNg0qAmKGaU4zUbcp9dmbIacQOaNVY/nTZ1TzLExi9E5QCbCghtIo9IfmwqxsVTTWMBJPMELlu0GRIlQYgPJA2VlZosUkklS2inJMmjWrKYBaCd3rifzmrRhCfMBt2VsYQ88EFmgqJBRfpPpO5l7w0gUDYU05ljVH+giXRjrzOk/sYZC6rnxR33Ga84LiuPPVMaWvflte9cmaaRRSBJdg+VNKqPUZs5zNSWWJ3Cvhu3Kqaem6SpnFJDKpx/aS/K5bHpNVwgeavT12zbkkNyOTVspJEqWeu77///1MN/+8+///qk5//9fv/+GGdjAKBpjIAAB6qE1jN57+//97nirYzfTti0kSZJ5UeTIQSOTYDhF6mkjcPrlJaDMulVy3T3+ZQRdQjGlTiNx7Z/a9X52q1WdwFm6XdSmfJkQrU0gAMFVzAqzFNyKWYEKZkEYNGBwQQLNIXMcBLsjBUBIiYIoI7RgAsNK5MADafFi+6ZYGCjwhimG6cQJDQyFjEQuE1IRrAQFAmW1EYqTiNQksZ5AULVuA4yRJUDU8Y4QOGEKwt+XSL9lUUFCvyFBhCWWgTTIilJN1MANrasokM26MjgL7GAQcCCRi/6CURgOsXtbUvyg8w5D0SFetbrXV6xeJTUsdZlLuKAySFRlu0OtelUPQZL2W0Lcoq5taOUMVBIIkBgmOIw6AoVQCY8iQiEmBWNTEkmHGVycJpo5lkSMl1yMU6KuQmR5TBtlMncoWFCiPBUXJQMOK4hWSHxWLLnFwTZW2Z0uWtMZDCgKC6jUYKIDxH4w1GTQ9MKyp1y9uNoyS0BdmBvzbsxgosEAHLZc5z5eckUhQKtpIldy3NIskdPoBJYdrtlbSu11TJTXpzWbikq7Xm74Y4SpFZZ0XTa6kf7kfu7e38kmPiloQcKkaB2WGCywdDx4AnlgYBDGsNBI0h82kQGAAAKRAMIG8bmJCm4dAW2YWgbgCcEubdaBTCTQoVCpkDDC2ZMHfVLuLoyuGhJVsRwBAMgBAACVQrEkAxoAu4wLAzQMpHMJC00DUaq5RpSYD/+9JkKIMpqH9Fw1hNcFhlCOgEIx4nvfkYj2GTwRcB5LAUsAAMfW2wFORFQwAQ1DguOUGDChUC5GVgkwCs1xN0tAbQNwSssgg6ig8JOxSunVMxdujKnUL6hiXaaU7jrrrbEypi6+IDlDlOTCHobmwNhT9ymGKKmX87TOYo3jeOrJHVX2/jLs6WWOVJGpO72Gn5fdldK/tR4HVgObh6bmJi/8ckssqCcjUFagpJCh+oG2xHqgVVRDhrrqlR4dKJBoaPHiOZoElCUSAqPk6NFZ04sFhIFwIOhcQCuZdUWBAlGklKSQHyYiME6OY8JyI9geKhkiEJdsckC64+8WhI4RCiWkCNtYGBs/AEFwAAiRA0OTRmFPQQ+BUbEA8TVFCkNDKHDp0i8OFEs4NxAqCFIwdglTSqEUYHRcFwfYHRwhUaWSalL2ucTZ/6b3e5lCdn530+WlgE5Zxw5lzxEgoZCz7CIOBIAAMHECUwMwnTG5ClMu4uY0pz4TjwGhMgMFgw+gnzAkDmMKwGwwiQMQ4KcwPgBjAFAoKgAhgOAAIcCYBcwGQAEpRIBVS9FNHwAgFqSEDgsZBOXsQeQ0W6IRgmisSKoiKoIj8zxwFC08EomTC2VFl9oWCMxEJiI6IGgXQwJaymchGRsuepriERAIkGCUJytjgp0pZJVQOE8aMjK11lxEjBhJCRJVbTtlwUBTC3uTBYEztbz7uk4bUIEcqXoSWFQS3FYZhdHI4zGmxzkrpc3ah5xaSj9QNiCrKhNjHJ+1jE8Mx1jI+6ZJugLB8pLB1W/vmN7kWScXInUdm1R+qU3gIapDZXMrpfdOUI1veyA7eNnPHzDs6aZcfWpeMVp7ex/ZBPWnH1E1g3TMxmnsxq1USo6OopejVwFTIG0i+LgoAwiANoorAADcKHxMK3CyEBJ6UiZB4DAkZSNIl1PZDpV5YFgy+qwgsMsUxVBVpoZ12PiyD9nq6FVvJI//7fr/0N+ihqagQJQAY4cJzaMSMRv4+byj4q+MQnUFcgwENDS6KMpEExaKDAw7MtC0waFjDoZMSANkQhGpd0boDOhMiZSagqdG1uzLQ7pWoXjDAWUggBSggSEI6Vx1wUo6aNswfxH0RhUP/70mQwBrpvf0RDmHvgXc44wBhifiP1+xSt5eHBjj5i4DCP2WTrfFy2QM9S2LwlrVipqMBY24LpIPK0JuoDZLCQSKXYryoNAdRdk2GSIUIQQY0CApY4EwbClExFkPo/n5wr7GMkuCvQ5mIYX01RnuBpuRPmVpLmhw3VpBqxhO9tJGSA/k8QpPl0FisXsbxIkU1oSJqohnIxNPmFCi6QmZUE9MFlRLUlimYXEqFM1QTphKtBH+aSaoQR8dDMeqnmhM7MuZy9uaZfKhFH+rVehqDKNSHgwTsh7wWZnQ5EqRWJtC1O3tKuUKOTiGI5mkT5/rpTtZzK9Jwjr7A4sbnAbXZwK1zwrGFXIB0o2hkViPc2ufJbQONijc5sVuPHNL5m+OiGCOMgiDsKyNc9EI1AVuwxTQszbIv2jKivUr+7YJlKWz29UdzqRn1/otzU2d0taq6ezUb7ppsuRN30WVkRGa/SnbRtGf/ugkEWzFzIqYxogDa9oz1iAtB1qn2AbcIGtNV9O0cNM5EGgtcC4IYmmQDUCqQW9ZMIwiI+cOpEk5BPOwGUXFWqMgz05ghAK0EEXU3w1J2mUMJmUCiOc1iUIsvZuGUTI9TuaTBGaJEY7Ob7OZydRoix7uBpORvK1YJKd7ccSFqxGsb0fTm21VOJj6W1QpzxZLI1AtitQ8w3KdOr6BXTatRky+W1CrUWf7AvxYKYa1U5nO2Mal2uZKxUqwqJbMJzUCsvIySOcZ64Ki71D3q9BUDjEljafKtUoeuaqyE1R1TMoFVhPIchDW1uCgU21wxQVtfWWVWmCjWZCHZ5puZUqGNEMydTuMjiyJxzXcBvcl25NzZCOddLl4plQxt7E2aY3BV3fNll9mTupsJlAUGAsf7y6fV0+z6R989ThaNSXmZGS5WT1FETKgRQxle+Rk9NNm3YrkB2HZChSY009zMMiOSgMgPyy/2aPgGucnLPTM+18lMy//Kf4PP/PIrqd7O1DtsMt2RSZVIKpOlw5RwCCEoQADxADMBzEOwasCEQKenOQmVPmjEkTUxwdzA6mjaIwBa9AcKimbtWAwZh9lQR04YayNBigEjeW6YtRloy+jiKokQdRZdMFtTaG2ZqjL2Z//vSZCiDOb5+RENPZ1JcTsiVBEJuJjX/Dw1h6cGTPOJAMJaxrCyGKWmRM6YE4D6sILfNebZPZoLfJwsRT8dZmLw+TSdiNxdBXU6LU5HmbiodHipTVLgZR0qJxNGVmPYgpVE95+FjHupFqhpk+JUci2uoJwxS1QJlwkxOhh3PFWr2wuahQJ7H4f0c92NQKgsKGG40tSufPmOY/C5nEdKgkc0jFMuGrJXplJRTKxLmYlTyZ3I4mM/zYN452KdHplDE24PUITBiVMVMmaYS8tkqI2rFpQrhBwox6m9KeOR5MlCk7CgJDBWWQRiRiBg6ioAAsDkhgBnVDEeRPeBAplgnrCSYBGoSJiufGMcYFAABsTMhsbd8G3SiopE1WDzu8exhXvbFGc1EuJLQhAytIrn98J9SouuQXR6eVvjIljlI7LVjIIQqXcly5nfitqlf7K3mTHqTUUxOa3ykf/Nb/onohjYMS2h0ExQFJRDIHjEATbwlXAguZVQEb1FjFpQ6OThCFDUQoA6RL/FUitgUOr1KBwJAoU/beP+y4t0tNYVmrNFCYdjzaM1S1UvQVc+Lvg3ylfHYMQ/C9G8UDKQog7Ehy1tCy/kwUZxGoxtaFypAqDlQtIk+Pd/ok7AnhNqKGAjGR+QpGp1Tq0lkh2VRpAF87kQ+NlEspzpxXPYZbVktzQzMZ+GuciGwkcuVQiX6BL8nDsjLCHqlxXJ9MDOwrk3ITaoG9gdO5C7ucBrOE/7s5amPg6MkGLcnXsdiTlSZqE+F2ZEjWSeASVbWjmLdEPkq2U3YCrYjOV5Urw9JY4xUFuHaoFOfxCFtOG8fiEM7QuGs0VtOolZK1jT6ElxhmWyMBkF8YTxHMcenEuCkTxkpd09U6kPY6VO5xtI8coOfz8z+X7dM3aPgJF52k07ZLK0FhDKJAwVqY2e1ZwRGUwNyNj52b24oqrNexbJIRyodkQQO2KPH1JJi78kqedSWoJqWfOq2ndEOkMja7kc7oRR9GeIWvY8UQfFSx8kXqwFIdQWnq2QQB6Lu0ZbRj4G46POJIAaZaBbo3DTiDEmgAGDSgKKuV00OIEQQFl3GwuCTGweJzlabpsH69TuhlPkRYLJgjEBYgmr/+9JkIwEH6X3F2y9kImoP2KAEI44g2fkTDL2LycM6I/AjD9E/OkpBJZ0IoN1xaTFk6sTlBkqw4JrKRcuHMSyzYOB2IrdTE8fO0wkuo2TgvIby4/MzlPc5VryqkKtfQCkja0125ozVguvOqWX0z5y2g3IqepjdxGtJUn5TRKFerVTCQ9Uola9KeWWIzhbNYzrS2uhO4T47MnTk/TFJJQvD+7ZaUjxsflZlqsd4+gPrHy0jFhQTGFWJ9KzZgpuJRwYPaYl83hTGZUebk+UHiG8OacywezO9n0z7LoSMAqVn386wYb+kL+U/pzbklltSYhjFqiHNK7AgGiCk4TMos0Kh5EGaLwnU45iCOOaYII9MzK1II4V3OihGvN4OYP4Z4KzcIoHA3ogvKFkeToJJz0WCJNrPii9yMO9WIW7qwtXfA4IUqfRbjTSgg7QlYREQZagORAwQKQN18eGFnBGGjinStLkUSsWh4izDCOWKTgvCfNFNlKdZJTUTpYE+VBCxDh4jyJi7T7icb9BRHN6p1SnxY1euSltOgj6kMh2EoqkBCMz0lIa5auJZ0bltgrQkZxCOxKMjKIqNXOi+IJZPieNcmrtFQ/HqY598gPGxkfCSsiUrS+kPzTCscvOoNUxURnZ2dlhEeuJUr9jpEhL417ysyO0xZXFcdnmSSkJ5DLF3rGZcToD4NeO0sB6y2drDwtRHjg9kQ+TVLxGVHhaQVxFwGrC06LNnyyUgnDpLVeaupywJNlgdsoCEcsRKUg8QOxlIyVjA1OUZ5MSpq8wRScaRKlUCGGHVXRyymWrl33Nsn13+l/b2+YlKerEadHT2f3rxbdn5+IF67GQyae/vXhU5j23toVNRmPDpBcWyGvUlyOrZq+t67/okrvVjnMHdE7oAIfC2Qtyd8OHefqVl8iLL90IQQREOY9A359giAlZtvpG1G0yQ0EMWMcobtpB4E0wDvGAI4hIKi5jjmeGrhJ8ZBSrRSWFX+v5lEXiDzRB/3umo6zIwH4B627SVG0QFx2W10RIqPAMTsyHEbVXkguXfEFMpP2jcvJEi1eucUnK86Rno6m/rawt2SoXsxreXsHi1dE04WE69xal4yRY481c/XRHylf/70mRDgAZ7fMhrLDVijA/I2Qkm5Fmd8x+MvM/KGbTk9CSbies0KQc/TuflSQ6u6WNCdoVJevWQ9mTRrsRktoRbPmTuJX0y9zZrIfKldmHSWfeomsHyZo+9PiGpVbbXMoQzwxi155tpyNgwwWFEqEVqALZECIby31l9d0p+1P/t+nX+/xtZYcIhCUPE6smnponXBWDJ4UK6TkqhOqKV2y2aUGFJFWeQprzZp2Quz8ZCcxnU/o6Wyldg1sjCjHmlky4vLR2I2NUW6XhiZ2IamZKClSqVsaUg6VEdRY+Ee8+ynptB0Eo1BcspUkT32XqC0Y1u2JVU45GRpmku0Zv5QA2xQwZDEBZEGA+wYGAyzAIJDxkV42yJisyMIiWorkrE9IoOovB5lCccKUsbYrnFOlylUBuFiPGIXtFqZWpFpU6vbGg+znP4kCmZVIxC6HiF8l05GeP2VuXDw/0Li/ES82oUBHDWORdIGzQpVGuZbCUTxbWB4iop1mtQZKZ1t95RW65WNlNryV3uVYjlt4PMid5uFdWXJjm6lO3L7NE3izDKppO2zUKi481EofcwuSmKW2NpybnOal9stiRzT0JMpqNY5rL9BURqayOON1tpHhGc8xHMitqi16b/6JS+ja//T/xuqMvI1lmzKKakZdmJjaRB9s88QMNNSBiK19jcKJjxlqRcEhiysZZtxo0qpGmFQZzjkXsqaINbmuYyRt3sun+5xiNnIG4bWNzbQlLSpxz9iUiGF7Rp9JMbD0h1Ye4cET1SOgNdVr0AK/Ac3VLrdtHd0iAvEMAEVBqeAacBeGZaaJxkphc1R1BweBJZwoG3BawQQKjN1RTe1+4YiTSnRfGSPkqpT145UrsdBkhLBJCc2dIhgPh0PjpJPyKJBfWj2sODNhGT1rJ8bGbxywgFaqc/hRrDhhlWbwxHERfccWn7K8wMYgNGIJCCTOSZL0M2yZi6hRmO9ZmSQ04p7+sUWexxbpmdxRik0AcgWXGla4+jgIDNpMw7KUe1HsM0W5dug4dRXPOxM4WSv1i0VrYtQMQZDEicXZhFN0oMy+xteTzCnLMmtKkGCN/RzPAC5rq8ysi5EK6m6t6Lzt59tv+yst/2kOwy//vSZHwABtF8R+MsNcB+rnj5CSPyXIn5H4yw08mfO2MkcI35AnKzNHlzxC8lbmuIgrHR0RqsJH2qebohuWwJ3LPaQL08qNE64huKN2fDlCr8ToQUInD5BJBbqTA2ZsU0MNggwE6CiQigYUTM4iAlFZpIdz4tZT0jCa9LDMt4PnP1LLZIIM19vkXXcoTmshCyxohgPUmrOUc4zTdiN8IqIgIQvqwUvmEHMYTDaI7RbhrLiSxpq90IfRFgHJhIJRwE4Ap+IiMfBKPSEckRs0MVr5scH8Q1lAzUiI0ajwft6QXT8slISxwNSoUiVVfrA8nyJVGPy8exKiJY6Ia4tvo0tT0xmlS4dJjy5knR1aLJLcspZZD2OPUCsPUiSZFEnPEYkFVqZ7KsYAcwVs0u+SHoSWDo2DMabaYMqjTVw2pHH2z8eSN49APY4ZvuGIqGmckYIEZbrfwBYdJEOdkUmWx2lA5DD4u09uicjQFnagAAA8qjXdWU2ua9dGnoik0iMvysr+Wfn+VxROVLJSzC4UJCMCNgvcyLr+KsmkUmpe9lQ7Wo+n7Eit1S2gDtw/hz9MpzOyD2DHPhrly6VGY1OsJla+qr6aN1SIlKH0sMw3iXq2Q1TqltsfqgAdBoWpVeYoSZsAQRwUfFAwCVF6ShJtIoomYTeaUn8wN100VyJlN9Wdh+2suBTPJyVOO5DhtxXRalUZtTLwNlcsV9ogCYosCAeJUxwnkYEQiSkS4oIj6ZOCJPMGELuVIMP2hqBORis+hpx/ruSHURwlxEdJUre6Q0lVqLFZvR1KiFFGcYZbiQ2wJXyJ4rYhqmTBD3FELTZ+nrGB5NcnZlaltpjEm9JVZidcuc8WTRqANqtyOIVycqOn/YnVi4aRmkGSchkTKKG9Qk65EZUhMlIiVCiFDRfDbTDM1iIxfFC+zFBOvAO4AA05mVj0dmozppur5TY4Hj5yN5XRhMj0RFWE3YSTkZ3NTxCJhwmsrKfIa6PttwznlxAxGdUtW0ZyUmU0UuUzPLmvQZMfjnnTGB/vjCRRWmTlRq+9OeRbYNUFHgjYFqok4g1IzX0heHkOhics32zrjbSAAnVMaVXcCBhiwxmExAabcyKYdLK4D/+9JkuYAXTn9G41hKcGxP2JUcI54c5fcfrTDcib0+4aCwjLlyEeHo7KrtDfEWBI3q0LFV1W2/bTnhRwdOkTnfh6Xle9lzeV4dikHu9bf934lPSielDI5fXh64/1I/VM+yxY1Yo5yE0JPiUJ9lwpLY3xuvFsr4i6etSfrH317UiW7UkHSp1CPDNUVCWPiQtuxHWRl1GwhKKJDDT2F8g57StSRWm2lpRK9wZgySnPOUcjlxcmLPTPJKKkQfNCGMPQByorEIQcglRI4SgZ0IWEjcQ+FGdB5BoPFg8oFk7Ncp7McogBAS4mNWfZZRektEAXAAIZtWQpY6MU5vSt/fCNzGVvfyd/PFQX7g/9i36JgozyyU/0fGB0j/hh0ODm+uKWJ9eWltdyi+uTPLnSUv4Sj89pw9MZPWefTiDF5fZQZgCZLHyMwSZF6k2I/On6hXBhSm62JD24ER/fr+q0XCCimuqKQAD9BjGBACdRqGliCAISD0gIEPe7BWKUOSHQ2F8QoAZF8aA9i/Hwk0iRpTtJQsZlQk2lVGMNvJ2WIsRMz6UimVyRTS/pRE6V7dcl90Iaj8LZtCHxXIZHY2YSOURpHsPB6hWM4ncPU8BitquLS4x4krhbK5tg2NYi+eq060tGidMcnZNRtIQ8CwT2DwniiNDEJYXEJ07bPJSkYSx/XnY9I1SEP5wUWnFtYBwKRYTnZQiFCETtHwcFg7OLxCbHO7MkwqJFqsQSWIhdB8sn61kSClBUDamA+DpletNBNdQTMuEkVIzx9RGVmV0KUzBA9K5whHi4rKLLRc6V0Y8JIh9LEA+qP0rJWVojHb7o10fAh3g49YbhefFOH8UG58kAWBFePbDpJi9ixhQgw4fbTHZd0HL6FXfMKHSkkc/nlDSCGHnH/OagkC5hT5foYf1G261fmJd86v+dU/5zxHGg5hXVRS8mAws2qx15xhBqGVOh9R8Kk+oPDAVMMCMSGoJKKTeeLgKAtBOVHz0blRIcCYlhNKWNCx+AADZVMCAmYqPlGBAAVVB0xSLxPRVgjWCGlL3hTlBXiBtor5cR9LcWLBWEKPwsK4YDcUpPjqeLSuo55bUaqnFQVcT7pAiog14yuUpACnPf/70mTzAfhxf0VLT2Nwg8/YMDxnPiHl/RV1l4ACJL8hQpZgAWR42miu3SsrEXLhtYUCmREsFiXTPWMuGFtiquC/s6VkCddphtcpCerbKrVLHc0W/fMKlvFXKqhRXy6esDGeylZH0SO2ocyvlIqdyzueJUo1My6U860zzM6iQKqYVQxWcHjczquMxHwsLcVhMJCGRXP2dgjwjvfsp+HrGmVilXSHJ2yla06yK9fY04dxvOUJsWnz9QH8x9ZXSvgNZ1/5Ra4Z4zFFa1PEjKBCYRwyXcWyzOnHjUwvVaqGaDQTItp2aJsfLeOu//+3/LnfMZTV+3MX/mt8v/P3uLZC9/L+1VMnr7uSzT+2Zj5/37uXjYh1f//mZ8/7I9oX8jKSl3ua7girrzE/3v7bGNnK3+NbmIZzMIPJVlQTWg5yJdWYQmrKm6SL1FFWMQJw2ftyBP20SgASNKszTVH0UBthMrLWcUpkUgVCy1UDjaYQAAAAHRgxCGjCpJMKCwxEPxo1uUi+ZSGxhoYCIZHDUSqmIAMYDDYoDB0CmJQ2j3Rp6s4AZ5i08Z0QDozl6hU1E84iBGyY5zKjGBEwmGJmlyxZEoqHqyqaZK5CUCtSsQAkBkAMDRIGSpOyEGGHKKUOFuzACYEoMhkqo3dryG4kMt1b4cOGChwhrjkwSEDZjRTZIl6oJHoeYe6EYQ9aRG0Li3osEYoKNC7VU1bSYNR1K5krW4CT7TDAI6er6P4XNRGoEll4FQFHNaEcaa7sLd+VhQpP9k7KGHCwqZ6Vicy+mjMSbdM1rLWGByFWVdTSXPLjLUUzQgVGnM0JlDbBwUSVM0VlEPIhqVNxZc/KYanK7kw00REFAqQUjYVDKWzNWfxZOlJ5JJtUekbl+jwKmyty03YdddSqypkakDlOlcLYUxaoj2AhUwyIRTBlZcdrSa7LEs1FmnvILCuIpL///////+mStXMps0JH1PtjDtLSVraE1BI5Yygv///////76VV4q3pPKHKGw8hwaIMAv2s9yEOSzQAAQAAA+kXyjJgbLgs/lT7elokbGvSnhsi4ibxNvdpjIE/ED3rNcW1/LZ1+uCWZkp/j3t/A0ShNahOF95l8DPlm9Kbr//vSZO2ADLiKQrZzIAC6USiFxDwAcNmZMbnNgAIBL6ZrDNAAmA81W9P8zfdaz/5m8v2z6vWvrPrEm8Vl8KR7H3jfiahXZNblpPfO8/MDN5cRcuoeJnzI/eSTX1WWPS8ab9w8Bqh6fPpK0pnFL3+J4MWFatYb59qTUKJb/////+JfbrUdxw803Zcq41//////LPWT/MbcDUO0oygEAgElAACkICEZra20wwCDCrmMZh00hUBEeQcnDMw4Nkp01iLSI9jRcUNNEoEzOHwEqTTamJgKnqbCtmsrYyJmZFZZgsCZt5SYmnmvjZmbQaYqivcYaRlRJNRDjDAY3tfNHOTJQEFsYJODHSAy1mMSIwghMaIBGDioIZMjGhCxjZWaeziRyFhkxdZM7FAMeGDiIsaAknDB8zo2MdAzQjoywYRYDAh1DHQoLk5nQeaINmEiAsfmgABgZKHS4oKoGiRIBAA0ETCgcGBktYGzcStyqYNNAgOzqaZlDxj4Wt0IL2YSqSGBABaRdCDj6NoloYAFBggmSwUDBMUWGYGIQB8FbWQKgTHd2omoytOJYgGBzAQEv2hoig+VmUQ4rty0GWbAYSa4DAUHBqMySTJ3iT2L9olwfCY0tBfl92r8WqQ++8Pxmbru+/8jlkli7uO4zqHXVdhyYKZU/8ff5pM7GJLMxaAp+nkMrjMuhx/Ifr5xmVBGHQ8TOHyf5UFA0ssKhoRfkKxMhB2CAAwBAAABsQiyhxoPBIn3lt7vK/1UU9Xj3UtJKo9pk8c6vXp1lNRKOb7IVn9E+dQUYJEuO03VdO4XgTBZeHw1NAO4cwcBdIBwgJqoIMghVZlWWgSZufM9aZg270FVz5ggnTQsggSg7hKDhcpKTJcv///en/2Mygncfe8x////+pWTR3JgoAAAAAAAJGS21Mo05MJF0xMXMyJjVTUy9gAzuDTsChZhpcBRsHMx2I6YkABQnEJg3gMHiqDiRUYCBsEBoyQFBkgkb3ImADhMEBZeS1MAOhkHKo2acLGNNxkbGY6OmKjBoosFzQMHyoOjw+ZuOmUjxqSSYagAZGM7Ak0DGB0w0VGAIOJDGg0GDZgYSYMOgKrMtBEEzHBwOCoOYeFCEbP/+9BkUQALBGbM7m9gAJ3syg3EPAAhZZU/+ZyAChkl5ycC8AEFDQQIAYPCxGhaZUMAQFIA4HCpigUKEpkAAstggoCL7UrWHMEC0J6nAEBYMeZ1mJBhEmalm1oIARIHTNSBQUUZQ1YFC3Eg1yZIMAz7LRjsTjMFFowgQBQ+oE0iAWSVHrZIn1HXae5znGlEBT0PR+AEaWaQXys/sXjcsAgWpciujK7UYfp434pKZuU+2J6YCk7TJuW2HoppBDj/SakidFF6kPxSmjnzk/VrRlssQtSqEROVTz7y2MXJ6t3/+n/+iR2TgwsAAAAACIOi97+0d4jh34DsIuevrG3zFjMPWPnfiUxnNoVs71XO773qt5dbzBzfUDO2s/4vzBo1+kf0ZxcAdK2lJ3bEyJlyfvoD6+ty6kj2UcRnfUhS6RadVqIY7t8C2oFc/X+83b5dbm+pNlIZaN3Nt7t9Hfx59X1a+t/f+s/Xzu2M03eNLimZHlPnVLyPYWdQ5rR4z3ECjzyq0NEMzEhgBAAAAAFGSff7OuJrOKMgCMg3FByAy5gdSZqQO2Xsb9p2DlRcdfKog8+IHQZUJCqKQp7TJfTWOA93WqkpCf48Ei2AGDqZNWY070N0DmSGAWt5oRahc506ADk0LDMhMKhpSNb8AUpHSDW1TOh50D1bOk4KCo+KYsoTjL5vorx48mGuooq2d13lbZ4FRKqvi7NWB2sOG1+AJRK24QyrmBbUDV0EpeZnsabRr0/AkiUadKkjMQg3KenmnQJAkCRaM0ketpfN1fSPyaN01LbrUr64am84du2c+W4ch5yqCjo4zb3hQy2rLvq0Wql+tMZVb1Nnnbqdww3Wyrc7+NvPtnW99q3+5XZBRgAAAAAAAKqpx3hrC1WcQtbzDn0/3778k0Kuaw/LGi5pXG1RL/iHPCiW8Fkkw+T9YlIC4UfzXVWVWJQ1niy+lVuDmnTjajUMH1UkKXiuMXqqFEeavDiVaqOFKS6gtjfNPnVKxXsPES2N33r6hzUg4vmurT4cryeJJxEL1GYs452kk3vl/W1OTUggAABZ0ihsKAKmD0kdVmfMgKVARnRYiNCFGY1Yl0zsCjBCALbGHCNoudMEu6zR//vSZBiCCQhoyOdrQABxbPnf4RgAYUH1Hw1lMcHQsGa0MKYpD1u6oDEE0cHCKAIKRmMSmQFmmGixYrGDxQxiESTqoAUeQGDRsAaiOG2TES0CwVA0SrmLVmYCBcKaZKZlEZ4SYscYc0OlzJIDUijGAzMngMSEYxAUsK1lhCpl2OiwtNgsAU5X+edYZFIwIBcsJSNcWwy5yZ+NtPVth1hLOaFk7XpN2tGZbWfuBn8daVSyBow71NfmJVSz/KbcuuUz/ZX9YZat/36s1f/VNvtm5U7cwvXpbKpXTXuWLWrVeX2bXcbWdjluxTSi/Sw9K87FyrZo5djFozjRU3Lty/SdopimpbVmIW8oTOXIaIHZd8PnOouQMEWAADAAAAFb0NrGLf//7f//e7Q/z7///v/n5537+3/8/v+7dplBEBmBKlp5m5tGr8URao6DFB9JeGCm8Vs75Z4SK3LFNOp4pGcRlsby+ezs/rLZi8/bv9bv57oHJmRFmtdX4T5t7qcGyXU3p6166TZ1eygM15E7Lg1sgEuDEjjCHQi6F0xYBmfFBgoDHh4uvMMHslBgVVNlS8Vcp8vwrEmE7RrmAoossQkKXgUwwxmSGAioaOAgBEwjVCQcK4quVziIwuIGZJwAUQgVLSiSo6KNWgwcVEZeJAghQ4WmOJOGDI/S+BGA1JQF0U+VKUZk0VHlVmiF1lJLZcNqLvOzEnZWKwJ2X1dVynhnZ1y7bvzXLEYWRGJSBKzCwrm5WLifYRRNJwdBjTKuvTS21YntVeyk4nlS7lqWXxtgzDFshBdJNs6maccQrJRggUUxxe1DkFFGSFBNEiSOuQVBAsexAxGijHMUZypnV1YJt4n6TxTKgwUmk7wRz6fO0s7r/ZwAACrtjhUClUO9jf9dnP/+H6/29/8X/62OIdPrCYmjMhdFtVhFhVmu9xbADJlUHwNKQmoiWTsoi7UJihaNo4xfkHO5065GJSqeYjJqVQLV7pnxXxTmIqSleTPrSf9XtLxlW3bKbDLfxXGrPpBUrEyiJQSaYgABAggMgNC+wBNmABmZQJlmITmEIhCqAwEdAARWwhBiAAXHgBTyq7CIgqyVLvXYvV22lLnWorllwXkXGkL/+9JkIAMIp39GI1hMcGOIqUwIZsQn+f0RDWHtwXI/IuARi1AG8vcVSmPIgMwWurQlbPJPJhUKpWSI4tZL7LqDFA0BAcAXMhWBiBBQEtAzlXLvEhB46+kwnJdiAIblqpWCvizxiLwvtZfOUwO0eHFixbc+zSXQY74GB5ASxKigVuEYgJ5RNIXiIskOktGEdKKomGEFjarCsxWLo9KlkRviOC8Cl/CBQSEc2eCCRpAIBQJBOYTGtDcjqhYkPIT5cVihUbQkysSCSiEC04NA8qXJTJHI2XKRDz2Ezx1K5TD7YUZXQNQ1bFmRey7yA5BlhJklkmiidTFRduJSaTdRiG+l0eGOt+jplMr+lS7flTtldash5SyHl/PW2UsCUIIJjUpIgFqyD87Jjeue1gEjJq/HLRlvglGq7I9s9d/k10iwFCQJSsmoOz4lARprzy0vmipG4iizDV2ydR/rlrkCI0gZUsdJ2YkWZBwbFAIyZkDZqwgGNqZCIargVKgwAggW0qiBBIOpfMlCw2qoHyxriQClhdJAMVExBa4xVIc5DWES2UZQ+fMeONJVmCBLvRxW4METHTWSphCAJsi8kMlDBUwkoSMpBBEWfdBFZQYTcgyDWweYOMfa7DRPElRGkWdJKhOiTKcphOCMi2kpIs9zNZnh8RC1Up/MLEvCEqM4TlN12eSTY25SltgtC+xSOJ/GkpVwp0kfqw+UDMhKORq0pFa+P+fLQ/QByMSQP9vQarSh/rZEo5coQprHgyHoqmKMdRgMJTpFSlUWBxadoeiHyQL/DdEoN1ginIhqKOo3XJWrk6ZlGfKvQw7jyTa4akOSUNkLkttbiuE+rF2Qt1nJd1EqmxSNqta1hXIwurs4TccGV4o4+myRSsiEmQ2RHgASoAAcTmmdzzDud9Lm3zPyM10FSyaMTKqNkYxMXKcXbz+lNrrLo9bO5bl19HpKUmyGI5WWb5K836orVR0Ol/zblem6Kv0d79l1mOJKVe7+1GFL3HmFHb0bRWYNQg0G4mgaV6JZ0QCNE2RDC7NFYOREoAuWZaaEpdTOBogUVGA0AqjCcaA2HqBFV4GZOMxVOGNrtKoKhKgrVyY5jpd5ZTvPFBsOucnirf/70mQlgzkFf0UjL2agaG9YlQQjLmgB/RCVnAABbo3iooIgAagq+6vFvu4j7KVrxAYS2XAbaHEhHwfwRhtMgu43BBUcW4c5/F5I2f6WNN/FWi6uSLVDacaSRZjlCqIUxbI56mqKiifIJwsPSoJZfOSc8qRpEhLQhoJZjcsn7Pl7LH7CHGRVByfnQ6Elt85Mo3St5FSLC0l80ToJqytO1ZILxmKzwfTY/Lg5Pio4Wnx8I5fSnx8aDI1JxSZhQltDAsiUiPy2dC51OlCtWMSTJHWkkxH8f0MtHb5SKxsLT7i1cS3KlgwTHKw6HArncEcOmBZNVllJ4eXPV3gMACUhBL/jVo0gazvK/CPyYYs66UjQzIoTPKNLmTAxgZEqtw8zMnrPyw4RzhLLyc/fm53VMk6bWf9v+5OZFFktKl25+ad7XlyQl8/CTM+ebGDVt7s+j5WHxfhKTwyvjmRF5na0EsClWACSo0AO/I7kHYhJOCcwbTqmELZkuhYMoTB2gIdMMkrCMIgDELJTkSWjC6ZS66GKyNR9QdpK9Xwfwu0oMmkhOpS/0HO1Dk6FwtRaYxCUrjaeyBsCjziroZuPGFgT70wjGpLWRrwUdd5eSp1CYQ05rjMXaaZGkt4ElcAMBYi7bV2crGgCMolP88EjZZJrbsujeWfANCpi2KXU0Ftb0yixWn4aobMN1obn5dGIlaf19Hmkd6Ba1Az+il71us/btyupHIOcV6YRHm5uP1+az5yhZz/vu8sAwy9kYjMUcGRUzY2tW4jXUTbo8kWlzox6XzLkPXDLKWRQ3NtcgaOvW0mOxqlhl63Pl0TiDqt1m4tBrzumz/WMPU85edrjsOu+kSgB0dtOm5XHXXiD/XIQ/8Au5AEStQ3JW6OZXqSmllTlT1WlAlmBTOYG1OiOa2XpstHZUd0fnoYwptzCnXKIDwXe9PLCg1MT94euyQvvn+/H/v/+ffWyJvGmP/6n2GmqHNSGaV3wA091+bI2/9H1f8HXt/WHLHL94Qr56C8nvG2sFtKxuOJKOptJMkkAA6TcyRAwokCjgUJMCRMIAT9MAYS6IoQ0nrUsKmjLEGtNJBBMjjDQQgeQrBNmpOGgKweoF0nDWO8Z//vSZCMACMGKSW5p4ACDUUi2wZQAI42bN7m8gAHCNKQXEnAA4wUKLwpiBjXJYXlhLGTAQMcKGEuG6e6sBUGEJkLqTGAiUKckeTpoRQYRdVcn1c8No/h/E6UzizoWca0fCRbD+bU4cK+/suyTJpLOanZjgmUqwbD5ONrG2z0ctq6kBlhSzUz3Ktml44QEpFbMODrdI8Gk7jNKr2Lfq+xhyeO4jyS7nNVhfRG2NNHZOpJbPml/Ccpo1Ku6MFmyR69adQ49oO81n281CjR5rQdQ8WvNL/////+6zPmd61xYMaBuNqC7//////ixYcSHMxwcQoUODDkfAIcBAAgAAbRgQOcdRREdL/i1F0ujP0vMRxlblsADoBxc1FK1F7IRG5ys53ceOW5jiSmMI0ag+hCxehM7/qUy7WMcxBU/xF2M5p3qUaSIEIcyvIqiDWIWR5xIphVXK9CKcjodjurjCPGuQc6KyTlP//aaJoiqciln//jDGVYih1KOHjjgBAaJs7JI0jWayy2SSFwjHCoLjhvpMYepjkkbMbGxnIjJwwuNPaTOxY3k/b41o+KEMx49QEn36ecI+KKiIYrgBb5wpjKwC6DIjMxVy/biIDDNJCB4aAC5b5FYwQGJRDcPJdrQXCagyGgoKYhZiDvzSTtI4V2lV4upAI4l6GGdL5LkpCtIaVSzLXZ2rfjBcNDdyi27nSyGlFUiUrUZ1SqCyn4afqYtX2trnceHJyURN24Hj0qiUtkLuyp/n2oZS/uVH9JItSDGX0Vuq7DTJx3KWcuymPQ07Uphm9TS7VLVv5ZVZTUxq3+V5XKK16gll69S3r2oa5UzlEqqU9fkqlVqUW6kzM1eYYZXKa1V/7PRSJbEL/uHLHLWr9RQhFQAEBBaNUgJgHAISPKi5Oi+ZJVIwshrzmsjbjQuN3H1LUNGrFEPqPDrlXNsfc8+WPzR05+m8qJYd0cdONTa3uxjUrOq5iIudvdE3PVUc76mmrtSpr9eZr/e/q9rtO2RPX+jmFG1/5w24/tEP4LD3NdnFSABwbo7k46IH8y0PNSPDIXI1EmByEYY+iRUGLLEQUEGEgwBEDDwZPsQABeEyDL0Qa7iAFmL6JXMpf2zAKf/+9JkHoCIfXxGr28AAl4PmKXklAChzf0WjT2RgZi9YliAj2lD7SWJwXAi14YflYZm0Jxhp4pS6EAM6iTL0vnaf+IcnqGVuPGopEqG9I4cde3PufHpRBValprt/ksnYRSTNeL2JfRSmWWrUM0GrMmhEvkdSaqwVMfnajMOU+dDErdL2gwvTV7WNn6aMUElprOVSin6C7SckGedJL8u0tqmjUtuU0bv67Wp56MblViVa7a+rclVDKqDCvYfvCS6mLPzvZbKNYQZK/t1aavL92abUIoscs4jX+YvSqUyB/P5NWY9HJNY5R5fnYmblyG4r3GlvT/MLDx4A0ASJCc+QIyECl27jhVjb4ZZV+mz2KT+sSd2NQWtr/ys7Vc9K0Ivp//oje6tR3Z+PU0/+3/V/9Cnb+ncchfpfb//foqrUGQcLhJkYw1hCpmQYwmKv6pEyCrFI9BccAiHCADh1jjjhDWHgZtGIMEnNFkic0RMaSGWCG1PGRNmFDqoqasHEgSljCFahUEMUJkXdEIGMaJ7lYrwz0uhhjjbNA4F+lEYi2xLogGOLmPcgo3zIL2L+NHZ2BMjibSeq40lNOrEIQDZEYjSbCmN6G6Y2wskwzLb44J0JoxEoltGA9KbBas1DEglkAhtGC2gsWK1tTg6biaLJTWn5x9Ep88T2zglqS4pWwH562YEA7dWqWtLghvk/lJoxVLj5bMm4qjk0mLy5kfm1ZgdKG0Z7BcgVM0SGlgUnKtyAqrx+RAZLhWOFBChPCIrYJRSSH5hSdQXW144rfODtabZZYcKSykbTHShhwsnztW7QqU8doAAQAjA9YrWSKjCpHTVxPfNX/pxfcPw6V/9V048gfmJnCKN7QUSpkRgyfdrgX4vkl/mRg9/ljRgzoZtKC1EOEt6CIzQtrGYjP/8pIUJkKJqvPt8CFcZSKkioV3UtmI7K7CuAmEAuCol1SQArAcR5JMJNkYLEDnHNNYgmAXBFEaIxdolOSQIyA4WAhwVm6vFhkiIauJoXGEHaKaegwi3EsYV9EMSdFvOhLJ5lPhLsTSzoA9l0QssLku4ZomgSUsKoXUJrgRU+oQikGRFRwVmAq4aKkzhY+pENoAOImYtWXD9Jv/70mQ9ALc+esdbL0xScW+YZRglZly9+RtssTbBub8hgDEWeHWCdxlguwToHQVbh4FNpx4+USVSSg2w4xjSPqV4qFisVGvs40WISPZNv9QlMVwE00g+vApIjUexM7a6TjKR1AQpWrR81mHV9HpG2WUoQZIIosQvSXUZaepKSZVM/qI+xIrqWMptFy7Uk1aXhkg8AQAAZhuI/fWG+6Y25AvlMDCDonEx3CBwszgQwgPEbVK2q0ToUlRaZvq+o2IuNEBEoeajf0F5PGGlbqH/61X/fi41fRPM8eiURAxlfUPi2FfCI5HYSZDIJ4LoR9T/dtBUYJ4QD4qdGqUrujCYuO3Hvg2Uiq0mIoHUAuEaAZmhGGcMFGEijcI0keQMMegKE0GhFryqGxRLl5y4KFjmOqxFLiIv7m0WvMMGeuepH+wEGAXGBJsKhzD89JI3umO5VgmpoFQhHchS0nVM6PvjmnCuFe0ZrnjvFzarB4vFUaOOJUJafRzLo0TCuaBTJwK9oHrPkUgJPYrOa6pAwknFg1cmGGDYupArDNnhY8Wua5dtb0hs6LzmKUFWwvNojQRYNBno01DLM5pEBEYYwjJEREycHzTnn9QzT/aZyxSoNiqcVzMXKIZRXTFikErMpLXeqLNmDzLySMutiA8DNBHlWn71eCfb9mzuCbK3wZCtM7v5GqKOYR5j0WzQdTsvZ4YGQEnQK5R5N3iavGaRoVGkbkaoYIP6CiOUfYcU3xJuhMTaZphF+IL2/iYqpxerCT+jimJmOfEztzGN1UoeGdA64TYcBw/jRbCVFQo9amjIUgG9bLDeEZeGTBaEzDRYk30EQAAcCBoFMAFnlEpSsI9KCydDsQ63V9MIjQxJznKtvHD0BtQbUybExSVhsWga4+JQvToJjlDBsnQnJw2slg+J50SQlD4d3ysOpyT41S0SRHehUIQXLAeNSGWhkZFcqK6eb5AjXZITqZM6KBFiraJQ2q+dLLWhzV0dRG4LWQSYkXaXUqVnm0JfUyKECFMgZehQ4ymrTB6G4zBxpxt6hGXuGinYoNMyifbSKIUJ1dsdISx9hCm0m22m5RYmMLU+zsUJhRI7BZJtPHpzgz4NsKMJoRokEACg//vSZHYAFz9+RuMsTbJjr3iFDCN+XDn3H4yxOMGuPSIgMI7pkyKFyfrF9wfY8BEvrpen8SwCAPyJXaxU2MGwhv/PwSkx8XI7k1+sWyF9Q/ap4/z/I2gbXYX/5F/H/7fHs8aR3g47v4a2wKXhbT+maAWVQLxGL+Ih9dpf3MWeRoOY1SCDHdf2m9fAg8MBlgAE5xQiI1UTNTFpBFMczQARZkY6oCQdkvEpUSht5LldZS1xYcn3pbmqZrsejj0Xc68MuW8zJMJBk2rNzeADgIiMTkhBMjK5mjUFYzKtDkGi0pnwHD0u6+kse1MI6EgRVJVhH5EfwEqEnLjuEAcwSQceRrWeLspHmJIxMxoNiOk05N+bmn12rpuTC0p5Gcs1C6lYyw+xFhXbpDBFkfOM22WERBLSFHsXuLqs4/Ta2JI3soGhAxZZBNVNEjRGZ3HG5vhGEkDfSq2u+CuS1uOs4pbbZeWbd51rgAFgAypWfQ+95zJJ/cg5yRtazy1kky6pFAMqETBtGZeEwiTQJDG2jvqEz/aNHF59CGeYbpMN5keKOz42rGN1kafz1OysZEuZVTHSHyFIdRyC5qrruopnBCxoYdmpNC+EzEOpM6PhYJZxK0eVNce9aJVKoHAA4aTRjSwAENBpMIMllwqCToQFkIoUBmCFmUBjgRrjMxTiHmoNwt5+kxWMo6Ns4kMnOxmepRnSJUrpoVjSxIpmUx5qlcMBppxPnihjDBLkoWBjUxuOEU1jpZ0NiZhraWgTJJlakcWkBQmKGSqCYn3RlVgUvVH2dMIqbXWigUxRNzLUGamfE7DqaZMqxbIzSRChJ10Nqwt8VS7S01zBnGm0Y4jWg0tImxxc4xBkliy5eRth8DTI3ruqZxI92DT1VoqrMNo0+lkFSiIpCBV81SZb42YVzF5Rp0MW8VmIdnZQOtjwFQAc5AgV13ntsmidQ5h/o/VoPmA8rkJVDHX7sol2bzGeXVdtmNbmDqeUSh1BZsjvbb7M78YifLGlLER44j/m9St8xRwsKKMbO3qJX4iVoxz+plXEDIX1Ll2xgrQuhnZAxgOIKOmcVuPEDlEQulOzbyNDXIB+Eooq1g4Y4yBaIETm6YLcGGeGWFz/+9JkuYCXTH5HY09L8m3PyFUIxfAcJfcdjL0vybw+4MCRiOHjLFNQcxJWgOEMEJAbjUPkqjRHQNw5zlLqjiocWCEf86TwZEBvRiLQxFGA4pdUnwjroHkDb2JTRzXXGID6FZ2wnI/TlpLxVHCfI0wk6RQbkZDSMUiyz3BEo8TAGLNFZIEFdMTjiooW6ONF3mpxQsN6n9UxTFKTOqOg+HYekQwaxSD20kklKL4m2ktuNYwmk6OsNrTQyrJvSaXmZpqtNLJwRsTiywXWP+Cs4Qi3U30kmXafKdpbk9bRQSRjMsjPJJySSbai0wBY5j91N6TInhOEmi+Uz+p1H9OQYcHRxTQbQUL4ALnUS5BszaJhvaOp3Q/VVg5wg7jnbigItRE8wAcFU/8zspkJVtGB/4GDUYIMpW2GDi+6GHMrPglN9Q4d0SZvOLQHofc3jdB5DiUG4EHDBEuAPIoJqS1xOAcpGgnTJCq1kRwXImnAoIai/BvSiygcmMnjUcMImAI0v+zlKxoa7lNW/SGKw0eBgKyzUG5KHwGhNHgFQhAaJxMKD4lmyCOZKwtDuuJGoY7gNBmhnDpmOA+PQnZXH04DuGNYXI0JYWEmmbtEpokRIzYcEAybagP7Lz6I2LyOA1LC1eX3K9R50rLFByPbictOjz14jJ+M4ZPCp6Qe6rlxoQ8uTRIMmlh6d2hdYSrlbhbOExR8eSR6yA+jQmTJeXxOLhNOTEnJLlVDqfQGZaxMuKCR5Qo09V1JhyIxgY8wcHq10cSmrYkY44tLlzuR88pnLaEtQD+hycR1OLqkZQLa/ABAAHT7x5PMZG1q0PrhXha3MV2RWvw1D2V6XL2XstJNk1/Bz/grOJHHmtP9o5eI/u/XbW3c4yN3/q0vzQoGH/H+GsOquLrFuVJHv1P1JKOE4naVEBae/0FpLEcgr8oOikaCaezYZo8K5t/Goy6CSeVXU8VmCrVzqhrxP/5rKe44NIwc5YiAlqADgCAwQgYKZiLKoluB4PMeDVJCADGiBfYwBBgGkq11OJ3FyoDk90hU0dyscTjJ4hiKTaU2pmM9xETOL8haylF98RCqeocd5fn5YFM2sIuideMSmNfVEyO01UifqpWGI//70mT1gTggf0VbWWDwhS+oJSzH5CMt/w8NvZGCIb+gVPMVONxstikusQ0jEemRPHBpcWi82JIzOmSYa4XUSGdEQxUgiP5OPxB54Tm5NAmK2CCCJ7JKKKzT+4wQQ6oJQlFQriMOxLAzJOiOWRgjLJoV05JMDwviCLzQeWRBEJVU5LAhGSCJ5XRsEpKjdIZYHpYj8cDpQJRCW1WmhdGpeAYrHw8npENpHAdhBUuOFlKqKh+RLOkrENKQwlQCaVzsKTlMZupD0pKB6BYfzAmnC4di68VS4dnQhENjo+CALXKp33g4bLfv0/JKMSOizn5NKdLD0bP8mlXKjmIjBHWnozUIIJgKMERTsrhHqoqJKJCQsJaFOoJw8V4mKmHuFqxtCk40pnXUaHZOqYyU74rGiLKAz/UJD9gKogfQwgJhkYe8KerepOhhN5w8OfUPBEcUdUY2U79cnIr4aEjCwm1TiwqAgiLNGoABuGo0qOOCLxgwCxcw4BJ5MNR1mamrasOf2AY9SvkHBpAslQJkekUkwTlLIBifhqSBGmbYwjVKlsFnO5UGS3KaQcqyqVUqoi8UaDCofCWmEkdfCECACQRD0hiSIlyq2uPPQUThmVB1TjwVTEpjFDjD5cpw7ZMTlZAlvcHBGZVjySiOBUfBxOiawvA9gEnhJWwmS4snsFlZTTRn744wpx4VPOl41SokYlE5StEwkNLymodcaKyI1Vk1CXrJQ1XDsIx0qKqiS0pKp7JVUlZ5KcEZ4hK4kUbSGrWrUpKvp1GdFM9W8WhyPUyrD9Y6l0ledI2j49XfDFdqsVnjl+jr33o9D4IQAACEW953ZLd3xu62v6S5bw6JBNQzfVEmqkZ7IPrq1/Qx/eQioUZfiiDg/l/YQVcaAh7/kQP7uQF0VhvdDJVXbPZ7ozA9cwwOvtXlyBXcPsTl60tuu8dRhZ1/25+FbPhH9qxmX71Isg+RefzMtis/d3OZ3tKoZ/L5DF9tNo6bjTTdkMaJI3i2ziYaMJgRPN40uY4zHbcXJcmTU0vh2hjTwyzUzZvOU709DUfpa8xDzcXdZ1GuPCmKzm1GcoMfuJPjEWmua8zgv/YZayezQvnkuZ7HekWVO1l1a07b//vSZPABCBl+witPZECDD6gYGGauXdX2/C5hj9o4P19UkZj4obENiIBsMx2LyYvCfQ6LS8sHRJJIiknDkvqjESTIlPLHVSNcstJNgD77RO1rCgTkK5g/0mpjqwkuGB0dD+pbNjrcRoLT56t2gqOScSjks3gXEpaSk7C9MRLQo48UEkQ1dU1EJ9a7ep4kNa86avV1u76vHiqT3Zao7D1ex2YW2tdQt60XKmJgyL/YXqJvetIXIIH12DAEMA5AKxvMZazBmla9lwtASRqNNV6/OMbJ4kkaIRUStmLTn/t7ZwXOzVCibRKPrU+vKZkqJIN8r3Tr9svc5qKkkkVd8jNVHtnX31bQrvE/yoqzkkk5xoV5e07fHZmKunvq9ULW/Q20fzt1P4VWZ9fLgp/6M3tboF8O3dIvmCt+14ZP6Rcopv2NcpK4aNOxMfRhOF1zMYREDAZAQHS9G5RZVj6vBDcjjNBSv7Gq8tqc1A7gQLS09+R3L0vgG1uO2MKGEigCVqSUOrYcEWB7UbxjmE8+y3i8EBjIFv0/d91noo69JSvFBb/PVSxF8i45nyvJjKALkQLLaKUwucqUcSlMrTYpKvE9JmtD1+Xv7GfhyHsbFV9ndiMOymX5SqSbiEDwixd3cJFqFRuVSeHYxDT10kBxCGbmoGhT23rj0PJUr3qSHaKFU9E+0ZbtBcCSSKzMsmRksHw3SRCvBUVfoGCo+08PQfLovRXoKpIcj1WVXoah7cDXK03f5DpACRU81TXVqweKV8mxFk+ogoa1XA3VGyuTA3HxqhYPB5beQyUfFCAWIS6EfEyRzmAFIPnbx/7cI9fanaDoKa9Rw9uV91tTdUGmIXOmOxzu8a01UNHM/NXXqVLXTnntrH8/6rYQV5iPbPnOMpeFeFbMZkynsQczfwqakpy1tGZGv5+ZdNkoX0Zx7PfDMYpHxNZtdt2kZYrT5ncgxJJ7s/oxjbDYi6sr+1/5ahGkCDTvq2S9Ri3pnTVR0ZFllrkoIDZMwMqNQh+MFgRWumTbYCv16Wa8itikmKSmn7Mmu02OdnOW1aHcPU81jUqSOmXo7A6BbABEAxMAMxADPyYFIz2lQTudEZhvFUZwCAI6lSnklaP/+9Jk/o342H88g7hnwI2vx9EwZjhgvfj0Tr0/Cgm+n8Cxm+FMonu36eCJVQw2yARhyY1FUPHc5j/ztxmsq57Gqnh+AvKMCnAL7tauey3wwlySsOIzZfT0zei2UDXWK6WGWKfQnJJmJnqq1BISZ1NIomC2l2lE84KgsdF20l/ZVOZEFxUEK52rLUlHisfjkPtTzrkLuFGfA/1BR8xse9uVYLC41niYiq2eE+tOzP8qJyhtc78R9RNRUmM9oRGxQSJtEq9TEF2rWSiTZNhWKOOnJICUlWBpAWH5BjYZb2No/JoykznT3ulFr4c2j0spBVTuKZT6XRt1KHJcp9sRfNU3uYYx9Wh2YTYl1FK568A2jwjtJ1i8UPH3hGtqkatSH1Y3EslbY3QIbwvS9SMBY7kbVWMrV5GIF5ol9jgydkKmrlnScb7fNecavTIs9/cfW+49vdd5QQtlZngMAAT41RiBDVQEIMHAAoCALPk2eJyulrSC1I+V5Tb3HqK1nVhvKHZqTSnKlrxHtvGvde6uXmxAJLUaaajMM36PNPBPOG5fA7Sq4FDpYGoqeOvjVp6CIOo/LsulUmS5I+ab4zL4AjcX+VUX1opL25EROVyqlZT/KZ2cx1iSBzdeX2r9+VZwXG5y07Ur1bl/hsrwJecESPJBYNNuzVevKQ3hAYsd8/SVYfezHeQ2AnHkaCxpXd7EvboMIumj1CylmayWvZmUv4TbdNlO5XKxqRtiS7Vd4uPvNHzBWLJEfuEJ41QcRYcJ7DfaxXFY7yt8yvHUZfYNsMadzm1NMyOPgWQkAOBAiqk0sfa0/uyV+74y7nMlR02yWbeBfauajiLaVOJ7VGSf082lvhK42IQg0gcpCDjQklSkJyT4j5Ut21U5NMlRZDSpMy7nDtboai6j3Lb+6Tv3BspX4b73XFonzeN+Sz27M2N0Y35ZzJGuj3y+YuE28o2X4TiAkg63dUI60G0bzGvDuiZhWR9hjGNieJt0RlMFcRY0pRXjL/L9MOsIkwLwTSUA5F9u0Ti9F3V7Lla7l2XYcu0+Mps5XohN28Jfana8r/SuYiFAD2bvq4dumr00MCECKMQ0sVQ1mCCJZtVt4rBWAt6X0rM4P//70GT2DdgBfj0L2XzwkS+30EFmAB659vZPPTuKTj9fRMSYAGIqgDIi4TCesGXLBh4HwyNhabg7QqQn8ZcIRHtcXRzd4fQXczwRxghw6OcGO5CwKp88JiNQ8WR7byrUijpIzMTgWb6FFho2Kydjy9YYB+uOoi02O11tDJtclRiLsRLTuA2OcujDFKc4UrZDvmWNmuGzLuDFboEOHqN5KREQraLQD85VFVLIMH024PnkiEcc6evRJPUP3RAQrs4MQsD0BFpoqnQVqjUYV4DYQQDQi5s6YSx3FWuxOEoKNWrJ+L14W+msk7FdFpjN6OHaaoyppLnQ2vkoM/3/Namncg7ApzTPhTH1qLQcumcbDnyBYUzy7PNKx4+utO4ZOdayKBToS9sb8R35N30jiRp2tztjZx6A5Rv43tlNMNCDnr30ZJfLa2vDTdH2uvhrZSN+MipQanAMCUPsxHifDKKR6OEoaYwKQPiz4OAIVc3j8SKetUcvnK1zkTl97PtvtDrcts0lSMVLth9I9TSZez7CACBPp/NT0Ifdx6oBALTYhiazgeWgEAiBX/lUolFDE6ltynVRGXS/PGmmlgCCk0YnNWbaiXkNYoESBHbcCmqtcXq+mWnDMSPeLGyQdZhRd7dOUMQpxewpSlr6yuNfAKdyeWpqZjgwk++ucUW8dliSlihSPsYrl4p7zOBf0Ae4JeWXKK3AiidzPdTdsjscFT6dy6m1tqjN+q7fPHS47KSTaIgRGVlZxEEzrKJeLVqW3NCvrSfajijL0/xqKeoYDACiC9ECEg3njXnFeyGtNscjjmVZRpRjFUjGjhQUMgFSyJPScCWEyZ6cyd6vPd5gtld88TRczDOlhHG1rpiunJ+e19LJumJnQ1mG4i732bT5+z0VvuE2JwlmnQgRPTm2g+cxNKbQ911p3ZaytVKCZXTSRdGcSYmvNaEZza1iNpYie+7ZKi/oOI1kpbduif2Jp+m/k+Hp5NxJgNASGCgK2ZM6GxprgdGDICsQgOqLMDhh5IVnZil/LtrG7EYjSSynnJXvtDhUnq3xjtqTSuPOzsMOxW7lT8eCEQOFMwfBr3MoiuSSrJIRdiOcoilO8VvkoqYy1q1i3hX/+9Jk+A/Xun69C89PVJlvx9FhBk4exfT0D2Hxym6/XwDxmJApk/08J2hh+3LCQcr1LJrdTDF/SnfE3n7CkXDTZPI3RoSaVcZ7JHbsQxuuoWly6QfeWu9iPjiiPG5cxPl++m04C27rDmq3l5jsktcaeQmJnj1J6fTWQ68B4yxqzJkxIkRyzWzOwR2RZxW80r2ND26nlddWVjMis0umtWwXOI+d4j0rPldsb73vZgeRoinhPbxH+G+01HCZTiMiygDaVX1boUihbelh+hV49Omezl3qR2qpFiOq1HUoTNzRePdnH5ns9qIkKP6XI7FNjWutkkxWWzItdQlIZebCZa6r4qbh8Rx8OUHYvJpnJHpnMxuozTKnF3N0HHGkFWub5xuS8uryLZPlomLlKJlpLLTuYPYJPRR3cYsS32E7o/iHaOWVSVYxM/n3ahAOSuDcLgfKB51SexkVJQAAuODECtPjB4xEETCwLTAZe7jt3eXbFq7XoqbD9YX61Pju5bt9wn6LtBKIrK3SYg6kgFAWoJPXKa7D0cploOdgkAO1Ww+gRqOKBdlmu2bkT86zJiZCDK2EtUCJ+rberBoHh6BMxKK6/krJrFGkmEo67W5XLocyEt9xYiwaWpy7KLx7STT5WbYrcOopGdTgsgbErJiZytlpslapVIWcXhhTLQ3SiML+27HSXIo9ST5S9Ytgw885z/BySKFRBbhRqF4QQSUeNIwJBIhGGxnnBQQGGQOmDgIoOMHciA6GUTmOOMrzrZUtyNffp7+PfvfXqV+yrn330g7DFEFiH9B1mngsH8x8R17Lmvt0LL6s0PdasgxmeLWVLyUhhtsBrNTFXGrtz6vC4M7rnYvU3j+0xx0m1u2qtdzFFGHRgMllvhgScuGn6JA7BwayhjIhGnFiw5x4SQcr5KI0dw+G9gk1EhieWqyCY0Y6eKc2JwIOnNFORWH0lLDGHml/g+Or4K3eWzCEyRfJiZ3/QhDSSIjDJvWnGNJyZDDCAVwnJf6zLX87KL1G6i0Z4EOHCdJx5dwZosFyu/yrGWA6SB03jMIhbEs4enq2x08qF2xGA+eTnUrVKqMZii1OybMQ8umuywsxEQGFkVColLMkSNV6w//70kT2jfZIfj4TiTbSxC/XsHWGyBn19vQOPS3LO78egceluQf2PTJMKGSCzuyiRMMpDaNRH1SWDc0BjCVEvBhyIvSumzpgsojn8QN2+CFyrXegUcGkplHaiQtkEYk8GSVEXPIHim6YScS5kmZTiYMiUr13rEKSjlo425Fh96GqWqLnFmUFvKnY49G1kWMpptmKWFSUOnDaMYmopkUQF7XCcWBp+9SWK9mpVybX8Vbu8Y4GobjBeNrm+YZcqlkdthqxV05hH4U+npGU7cvzc5MR6agMhBmFlYFV8GVT+XhGAijKLO5dUnW1LTRpLVKUdE4sojKotzkGvPQIXo1NYx6hlaCnKk3PYyyhXOFDqOQUTbQr4cZkKJ9C1Mw44FV0Vic09xPyilLE83Jk88+1a8owRoDJnEU4di4VkEZgxa8InricX1IiohamQtQHWJqmT6gpYVRHCqEqwetlKRsi3DUi2zIwkGszV3s+XbIaEZRhdUMxLOvK5qUUebLfEZ+sw4mXz/Ta0uLVBansZdaovFA/Usc4wSp+pZZdl9Nt44IdCsn8wIJNJR2Q3Jucof7EpkyD5IeM1rry21R3dgcalc+v4wY4/td1tcU3jhZCSTtZ6hanZWUs6y+zdUs+W1h2ujbQianWwKn0awlG69cu+NbYtVTR1LhMPF5tjCMoTK6qw6YV3HFKXiuth8wUl8+WHC102MnU/Rnr6mydSuZHpg/jWKnzwkkh44TMEJikMCk5L6lU6th5cfXQ31awkVEpaqStmVFjTjlBkAAwgFcyBxc8rYQoC5TzzOa696xev2ruTxt8CC4KGLaV87Y9KFoRjKuoy8yQlYOw7W5+RQIg73qJLeF6SdeRBxHI5pN7DQwRi4d0eDdgmix1ycF0BVVGRLkCYpVNCqbmVT8EDSAVohVJJ8hsbVqLm0DsQm0lIEbDLSHgk/TLZRuYsjNkC2sLIVkaBEKiBQQwgcTNPZVIEDiREhXNEp9Gmyhigt5xVAhG3o4lkTyKYlQMtk2KwPmBQSyRQKTROIZWRICKmCQTuUITrjS6RtOLnU3JsdVtAs4kaZTs0gOiEFTRR05CIEzHiDzLxFxEBaznJhVHcsRiK14YnbVi//vSRPCN1yR+vAOvY3Djb9eSdeluWUH29C6k2YslPx6FxJspU7mqueV6Q3bONPX329TVpTIaTGISPKUwpIYsIVSEFhMjXAKOnabEYgH1ABgUciJyKJc4mS0OQVm21r6QiZdhhBETAgjpJSE2aYjMfG2smoY1KSO0oFlWbFOmHoYRCxpBTmK6BIUKUKbScyg0aQ9YixHMTm2aGFIqK6oi23bZJL2YxHVByTJ0yBd0cSjQIcfRKciRVpU+OTdVRHCSxfGkepEk6ySyyraFkYFValDEjcW2gICxnD9mpoyFgeqJ5Y9RwqLY7hqZl9NLK9BG62d+7qUxuein9q2qteFxalvs8dfBl8KLTagIaBQVuWCpKQoJJow0TguJmfNZdMwUovGDjUgH1CifxV1IUo1czAtMyjidbWVc9A426ckZGPEOpL7Fqkmjc2m212GkknIiCwzxHCkwJiIktjMrwQIzJgondGGHRiKNlFlGS1EqSXdrKs7U8cUDYokSM/dTApgEKo9yMlgdk+7HkSBEEKAglIBUZdvm6WoEPfbVEgcS1SAMJBDRmk5/sCGZiThpjyeB4Df6HTvnV5/IYfTYdMHKmbFaiVei1cdNGmqpQ07lbhUp7NXE+RbUUdarRCOcELWD+RTSxeKELITJEKkOAysDwB4EoyICdYHzyrOpk5CJCyEcsIAqD2sHdYEyEikhEIDGpqiNgTWBkgcSiowGtYaRihpd6EWIVIoV+wfXRoQMkrDKGLnTISAnSQ8ilNZCbWw+jmFGmGWkDNzPkR8WVRyg5JhNcmp6G36hiysjiU8Kbeo1ewNmPUkSA31JJtu9pkS5Lo2bjFgr+3kytMwJRagGAkRoiyc/0Bjk1eXTcjaYqdv43MRaC4DldJWtVIu98cdmJ4UtBef6LNYiu5I2j3P61KTyuA4dTRcOKrikkcIo5CU2bj+sQhnCBEqk8fBMKi88N4C+vgLdgnMyj6VgtFkWoSx/LnJ5qRMdobJBNV4qVNI1zI7s3aIJgbKzRlrSzSM7Q+iZPGP9f3vpxJNHYvYHo9Q+dK3sHS+F9pW30JTQ6u86xRiJtZEdZqNoJlKPdjEi8BRADUNjS6U9I24FQpWrSQoV4CD/+9JE0ozG8Xu8C29K8uEv54FthswZQfD0TDDbC12/HkmGG2EU1P8UD24Y81EZYpoJgRBYGjBzqDBPScQQQy6kAWCGSBXKQEKhyDmPWso08MnvUF2H5fT2oxKakarfAMRv1pZD0AyV+H4ZrNO7Fnua5DN2NQcyeWTU7PzcsfRxF+CGQC9pfIwoGaoqhwajipIxsF56TQmZSiof32YzIKjU5XkNeZuGCGtbglbViDr/BF8E1gQ4Gsu9Vo+Kq+vPoiJa9HmG26sPYxtKnptwMu64aWShneamnVqDNKk9Ktz5sxF7cqbV4rJ6FNhDdiEMsuuuy2UnLOTqlvj2YW9204xxZ7m6goo4gRUHkBWhAlgNyUMS/kMCs3mmsOc9M5jDUfgvOJR3kUqR6Xy6W0+qaIU92ZsRSdmpDambkmgx9nUgeLMXpYHZa1K04jyQmkLSkfoQoEsfVKEYnJNWjsIKJAJ1nDhFHd8yBlZ+14kN2HVsOPurXXcU86y/eNp6x/yVlqLJu2tqtoaYcPMOMNu9ry+inIKPXyDqCybnjglMgORPNFpH2wW5QGYUiRLcjaBwNRwMHgiRMKImy4RwkASmRFEEKSSHru8HoEHRQUQZnPJrSY81NK3OSJl0s0IkCvBrlKpnCGRE5R+xSJ3O1GYYfbkpmWZM6rR26wWBKs6ZdNMCrmcsd+pFKgXy8qGJngpNiVzyE0nS4PW5jSsNiZWp7BPdlbWViH8hzNDMIuSifoJldOB8I5VJc/i2qU3VyaJ4RXFSn8ywXsJjispKgHlyJsi0w96FJgs8wQ2JUBI2CZsR0QAbOkVBQkxGhQQiRU0TxngVTlzrOIsDrbmRg5EbKMsoTTTprIWFS6FChiSmkjRpSKxalIShW7T2Vb0vzJn4kWanGDSJsmcrRR6FmhK5ETEaawwh22UNn6wnLlTKBGyKUIUXYS/GpLCOe3yWkrjUsnrL6QGyZnmMDSuBHlksiWdOJRJPyaveHQT6GDBqjOEo9sOn6cokg9JZUirdIpjRJSuoJKV8fkJcblazqsf7A5IhForBENQGSGKTACLiATRLP0mHaaJe9BNaNrnnkkQ8qszrSBWyCCBGPkRUGwUAPBDIMDh24//70kSyDccJfjoDD0xy4e/HYGGJjl1F+OgnvTXLkz8dRPSyeXSSi9szaec0LqIYvdMVTJlgUWUCczMiFY6RVwYG0zB3VFVHwZJ2LkcZM8dZTiQqgyQLCcBm2noDTRhENkBWArYmWZJxRJEQI2TRAVbRGi2LqmCHbijUC6woijQGRWmnIMUTUWg3hZj+OodJ0s7tIsKuW2fJ3q6IjZllwRWoCZYGNuXBxKmGymkkXrKpT8QqEyPSTKNJvi/wVWrzei0WW1GMy62uVM5uURpWWbZ/R25yO1G+Gehw1U2jSgtbpfnisuKyXkqrYTyGiJ/Ec0dhtVzDeRJuLyI9OFUMBgG8mDzVZXJc020+VyxumTUR7ZhhNxhGSNSQopnDOirhoqH0IPuHBxASEGIIl7MnyRosyWN0Kyy5/CMwpOaGSbrWaFLZ42NEaRVZs9BCQCb0qCUd65AIzBYrRKqgHzheyJEhFNqoiJTSkmhZokaiGCJgKkVA7BNlWwtZ2pBWJo8E42KZbJCfysQBtFwOxSMDrMigaOHMJWJIrJSUwHgtoaNQLIBQIBYGR86KRZRgUDRa6LLOJBgRMg0HScRgqIV3kxk8gB4EkxKZMHSVEfVjihxGbJyNcmJmypE9CyWRTEIhQDpFQEA4KxKTJy0BoXj2QSmdvrKdFEoYYihiYWHCRY4wzy4+RtpTlbVbW77bPNVuenBUJA4EgsCOZls7bVK16VNZa72WiQk69PdUj2jjatWdlNm04h8jbRo7onT4/IJTbfQUbbGUZWurlU/6NUhoa8t2RwAKmv2hxtGEBLWlc5PzRCP2oYDxup20YE/DNps4ZTpGWENfWGqs+XIJOLhKHgqJ1CgKDEwE1GUz06Qy02ZYQiYpOTAbWhRqzP2LkB8geUbD5AJUApYB0+SoBOjJmDRBNrs4S2SkapGb0TyaQWmRqNvJ3vGOMPVQMkCFIq9SMp7BKGuYJYHZM0umQGWCFwP2MwWJzRPryCKORNgTWLFChOwgPKFZrsIm2mjjRxYo6JIZQFVjqJEhiwGYNh8xAISb0uQpOERKN2uIL6HoMKuAAA30nCOEMEQ0R0bo7TlAkeeb7CEhIQVDxMPND7cDDLduDJdD//vSRHkIFml+PMmJH1LXb8doPekEXH366iexNcNiv52U97AAMqRNjNiNBRIcEllnCBAwjKkYgNtC6MVIA9RU8OhEQhkQgqQiYmHiYLFBEkNMEp5CSlSFUr3v7XKWliIcJk0QjaXR8nuJKQiEPkWk65O2UFAUFa5gkJGIlzaWLGxE0U08gInIoxLsKygoeQqh8jI3Nk6MfRIkRZNW09JYikWAMaERoQE8XkLJ9dZNhQxLOSWqkhmVecaaRc36axuCVrWignKXaU96gOUivitRAkhem8VotmQgApFiESAaA4hHy0PI3TnVK6ZVYo20zoKucV07a4Lx7FmZMKvSo2IKZYPxBMGhSiHokno+oy6UjJSqO334zxoguHxiUyKdIaQtHLRdVFlUUx8VHcEDrTY+DsSyYViCfEkuKxJL0ZqZFT4TdouOnZffV+gKZepYvPWjLNBSpEo+E8bGQnoQlW+LFV4ujagios3EiXFgsKHlTgWRsCoHR6JE86SqDYlAUoLikQTB3lnwFsNvYIFzhVNpgy9GQFaVk+mkKyAnVGlXm3VTyWL0qXTd14R62JZWzSInSIxMhESMwTK4hkCC4cisE3JuEwUIhWylLa8sHF7ozupmR0giLS+9zChs/YMEq3TqvXNeK9mjM5WRFRcvNm33lTh4lO0xhGaUVlxCHstrANwBITS+TzgeKHhgnMz44WNzRp26+lNebbagYtCV068zfpEssyjSFuE6MT0e1JARqAwbJZ8VlnuLtYuy17ClpfRp336QrLNmS4sPEP6FpmidSkPaExeV8UIZmmM8JlX0JQnEt0zJ7pwporx1ZDc3cgX2bfWUZeb559tjeXdV+X+ltikKqE/OCotVn7Eo9KWwqkShDjziAA9GgziX2XZbBGo7DWoKrz8pcmAmtQadL+JK0OlRyiaiJKEDYViSQEcZXKjRVMBKEMRV4erRCXEM9MDY5VJoamF31ixw/YZOzhcZmzZFMlw62PlqFwJEYAQ8CQfM3SaE4iTQxMIVVjaMySljpRKcGV4OMKlqLsoDSxMsmySPbQzVbSXtiTTKI6hUl3JzxmZtWlmTyFirp6rCKDXo2hcFqFUrPGWjR1VGqysRKnlm1k3/+9JEWIDWYXa7CwxL8s2vx2A9iSAXxfjzJbEgC0q/HYT2JrkEkzMm0KaEeJyFT////7Qpd/5Qz+5vfl0yxQQGALGHovBIU8BROXe49baSi422bHAqLjCayAKEZMBA2fc9SiM+STGjAjUWAgujXNHFYo6QHScgQtkhQSnxQNkwoBfg2DApCQ0VKlCxAkJ4EqMYYNuSqcatdA8kLvc8iTTJ4HuwuWgF0zZIy+ZeYoRmUYWCghLqLYlFspiPJsvSVXWORTZtppCVGhAdFFwxtNVZaluu2kwdgbQHpqW0oXYNpEqazbySSE2WHS5ZkjLrmJNZe3q7oNz+7N8HNyYT0VpCRVEsF12CNObUGVClIACAIpVGCAE4IFUNDhtAqdUZbUbaPCsuiJTZIut14NEAzTnoJzJkJtkjKEZNooakQIZhgjD7zxPU216Uc9B5ig68fDBGHiVExpAoRrKm3EdMs3Hdf1/D5aVyiRzUPWgYNhQuqJmEbEUCMPImR8kI0oylOUzUV7T1mBiRTqM9uPtEwjQHUL2bqW7FZa7MplORG9J9Xb6Np4oRjRlsSKpI42+bc0fKOtAh+f//9jVIqn/7fif+P/fOerK0YRpY3lLhMDIFILYSLbxKsMBoq2NiGVbHFFq9YVeUPVza5rzxTxNUafLk5awnHYjqBpMRACF0bFQJDY2IMaYmHB6qQmT0OHEREKg6ITC0l0osdMnHFh5DsJKlenT/R2Ju2MOorUXlSJq76tJAwzVw46N9O+gODxAQB3Vi9se30r1jzF01cZ+mHVMag8gQro0LZE0umXWkOoWJtLitAKDxASHCnMm5o7T2O0lfy88kTmmteqhSgjRvJ0Zfba9aun5mm2Fku6KSJlqSJUUhxIsRDKJREckgPMlFBm1SilkSgYk4koQ9sJ/iecZeW2T3WP1Psm/iBu0RcVJpNkaBeCRh9PgKXoV5wdpt0iVYMmhDRQ3qIjRZAnHxYTB8HhGID4IDg+ZWFMmV5zlbcoSUrkWU9zZZNie6ZZkvdxcFETkvFghcdXc6CmMugxAbhsk3tni0VgqxKjnXd7eQldE6SwkPNZzGkkWRIC1E52IhaqI0J4HZS9S9dqffrU1Xjw6Nzf/70kRTAIWBfT0xiTRy0k/HYD0sflh19u4HpZPC4b6eGPSXOOyvpYVzGdDcLkcN1EgtTRE1LyOVZYV1lmYVbDQ1hNF5EbLG2JqSuTai4LIiJoPiUhQuBFCKWQeHjjbLSFchmgXYeKZkrST5TOnBmIhCSATyWLqMpOqzUqk1STTESScmEoyELyV5ks+DG4F8r41MdbN61VauVMEaAlFMvCUnE4ZhwRzg6k9ykWckXsRUPV1V13n3Yz18xsOMA43Kxbgf2zjzcMRz6LmVi6jzVLWYTwsWceYeeOj09MXTHa/rM0t7Ec2XS9lrrqxv9HV6KOmLKYkqmibKflaT55UftRzFKvFv2onkDUZufyu7WZHJMwXE8oKk2wxo6c7mjrCRnTFEcRpVkOlgTXIkDLI+MlTI8mgKWdRcJxKO51RsTDKx8yg53ksiNlFGC81G8SQueychqaxRhV5cnOoomSNdYwXIFhrCdn/EB5obIRXo1TNW8zV5M1ZTj7S7335X2gPFx2w8lclW8kPK1u83aN3IXWI2lLp/dJjazY/Wcy/VtYw6/dCcUcdbV9eyxrzsF63ZtvO4/VN62O6uA8iK8KaJfE1+QXZvi0qii4mUOMdBnE/in8pWZxhOdI+mpS0VKqhqiMw4h3b3bg8hwZ9v37yBFuz0blo40xqNZc+qRSMokatTRSPKE4hLNgkQiQNAKgBoKhQyRFTzR1BLGa+P8tS2nNT9LMtsIlaJ2TgzzKJNlFFlEs8MkSM8snDIw1VJ7MoVtra6V4suwTEJRGSqyqCbmiFAyWmhSeKSxsmQsPvFGkJVyKMGrhLy8H7nm+0IxG/9fL4mOQPwMKkB2qDRUepZVBHyEKkIklMuLl/qnUTKZrU8brmvtuTSFc49c8bak6Uv4hEu0HqQjuPpVFSYptm4ZA8oDd8kK9liCTGgKVEQY5wcgjBMkEyxBPeyMPyzc2bJijsNWRGOSZFNBxqJJKQVgIlBPAAmtGUbaqc+Ky15PbHQ94bQE4nTVLSnCvCRRl3lJWliPa/nLeLsaaSkUlcw1veIOG6SDK3dD5utFhFewZ2CWqg2ZKGacCAIAsAmiMgUgrxZTwIEnlaqoMWR/17R+0OFkQpD//vSRGOMhUx9vRGGHuK1byeGPSbOV+Xs7gg9IIrZPt3FhJq52Gl9MLpXKtfe5w3ZjO38GsjdUii5ERh9JKLotNp37RJnzS6qqhEoLvjc3HFnNVVnikosYk0y6fOas1E916WtqbopqHFUMXUqwUmnU0WCxRsv0mpRdDWoIUmXJXsnZkIOpFFC8zTV4pNetWyNaX5zVl3EGkacFWUUlV0UHZrSFVFSFZMepGBSvGxH7RN5/CD3vmdr+lxW7hQMAbjAkBJQug6D/RRlZc+tY3IUhdsUCUxAYLERl70aIlE6AP1SBgqICVECA+Nk2BKg/qcZMrEpGKFy2Mt2iUJ1jq5OUJSc8XQKtDo2DiENGA2FDsUl0RDplHBAq5hAkRUyflFH7204zQJsYigtfBpgV4Mpael5ZcfK6ZaongVw4VwlFTI+SEa6BM4mWQvdBEYbMHSk2pasrrmlG51dXPwVVu3wXnHFc5e4b56/373zz+DDa2YnMk0sZHzJll11lABJgi2USGMKBMGi1d/YtI5XN256em4jNUTyvZDkcmvu2JBAkOCAPLVUc+tNNSi0bOkOIkVRtUyotKCg0VXeaaOAsImB4ef0iJFMhRIkTT5pqxk0+d+pY09dNfWmrabXm8+jOkPjN5surFJM0PIyEyoWlJrYurV0ymk171Ms6nzybOSjlbM4z+pIzqSSmOssSbRJ12bhQEViVzFeGOeiSVl50ab52k3M/0siipjXds+NSKBAz/pFahHFMNpjOdPnPFYJXbNXUSVyY/0/mZZgccwKFORnUU8JsKJoidHJhVN8E2IflmnNyJpJIGTyBxcZXa5s2jccLcycJXChGFVV3kr0bdLRSiz5hxeHgRYetICmPPXhMODrYCQEJ5EIIUh2kEMIXAfjFo9GsNvhBlFlg5I/YA4Tc/N9VO2uTlng0mN7eTNo/jtU5ZBLLkdekwOCWdST6tSjN5udWq01ZcpkxO/EW6fOwR8TtADJBigOIOUSUlKJezP25NES0pplFjR8naUUhbiVCQlVYJKikEQqQoYEBSZQV/dNJsmvBggRIwIGOTJk5WPX5GhKJEqEETSz/DvismX/+IzJZ9tadu85lue/oCMAibGAQg7/+9JEiQiFhH68Aek0cKYPZ4E9Jk5TocT2xhh7CuG+3ljEm6Gjzyjlr7qRloj7us3YwyOTJpoPZ5PdaL3bu/BAnbECBlLWp91dM0LowxCTz727or/uklTNkzuf+G0+21JKvJpdHaO6XXCsoggFAkDMGgDg1YPyatglRl/giXdN2azB6hEdRrExy69G/Nnm3bGNzVUXywuS2e/e2m4kbIwVog4iQCR5EmB4+j+iVYQKFwUE7L2W2vUNkVkdE1z1UedpHK2Z5rkvxuXhVc2e1c7VWG+KfFIxAgJUZT83JgZCWNElExqM9ArBYbzNSDqFRBAJsiHeve9xiC5lKMJRVBuU2Nvi4wp0DSog6iEH5SHYx8vqYk1YvosQl/tqo1LafGscpbHHYZXq5cbL/tKSaOi49LyssFxLVKbwuGZdKypcLSoUSgiIXFR9WRDhOyRLuJH4RRJHoU03x75pWoxsxg4hembbqlY2h6iNlIlYFbIHH+EXkZZaL1G8STtZhQ9SNuUlabkhg2cImFhuUxNpiKaeOvoYaXiC0UX2mp/iTw78p4RZbHThWm68U/fNkzcp3/zbZpgx03IULJcPLPibz25REkKwS5VqFgYrd1ExK2wbPoLleuKglqtMuk9dVhLWpQhBY0XWCoZFQnB0ycUNvlTCBLUZRxLjZ2KypMjwsijSKSqGmxCyi0la3KSldmXc8iLIEdxTkDraEpASATgIIUDKOcBIuOBxwbnERiJVtVbDfaIUGEBDBg6xsPVjZFl7akGWHV/rN7HsPKon+q4P/IvRm/4Rf/hlAC1SKhAPYZCQTTdNXdr2VqxVvX2NfpNuozLl5d2kFlbnHzSHxfUrEaGe0jhtHbPx95ZApTsbqg7fLaY8fVU77KdaBFMqS7+VXem+Prz9dL431subRk5wODCoPto+tcQ71Bu1mfQzTpoDoIwbVWbuhE6EaKZ6mCVwSgloY6Rscuj0pAVefnTT///Ksh5qTOqGhnSMURFpCPiEEBG8apXGgdZ8r0x1Lh/Y8Uyf7EZKjOhXqaKPWzvms7Uo8w1IgmVWX/dZdwe1kpTUIWYWoVSFLY+JBskIQ9AEiAwJxpGGjKM8QzeqmQo2CdEsYbUi+v/70kTDDITAfr4R6RxwlI+n1jDD9Fkh9uwHmTMLI77dhYYkqJzqoMwMNjCqE0w2esgeDyKINKBtx2rilNEVLkqaIlJXLJNQtSCqUBUoTixDOaFlNJMmMEiNhNRssm0aQI4K4mgTQozxGc48cXwmWfK7IVZMEJkzSk3vhHwpZZ6+7rdWnHUSZOZEZANiZocmgRpJ6SIJOgaWhosClUw0XhQI5TOlJ+VC6uMBDHsvC0XAwFykaYNkhGcKpKrLXsUkzirYrElmjBGcVe183H4XGFFywyWEIWJRWBYME4iIVovYQEaAqKiVtSe5sE5QXSaPN55yZmux7aYIxguqTGG2HwLjCBUmJW0BuC66BNaOw2KdMnzDaSq1LlDpEKTRIK0ZAjUTLIW0EJ/qFyh1EaEhOg8rYemszNJOWfWXumllrNEhOSJkTHVxya39S1ZzZhtRVK7UXWTaMynaycIrK0o4RjCVJMDUVBaXk8Zqgll91OYFc7MC2eGaRmBCmTOJlRVEicnmniY8TMmj468z3LwI+w2y8qoH1DjaBHLW8aHiUTIREdGlyBkXBkTDoiFJEhM1kVlUiqSUayeI0BGuwbYXWKoiEhWLqLskQVEQDFyAViAnUqGxWcsms+kOsqKwTTfBdgnMtiloUuRTRLvr4u15NKNSWmr6YSikjVdFldhW4wkzquq6rNKeoub5MiTb5ykENKsJsSQYYqDqHVrrFH79YE6ehIFRgC6IsoOSHCCtHEdLMkWKlhtBOJYqdYNnjRKsrBUiEILB8ovqAkAsGAbEgnFBcsRIUSFpzaBGvBeEjoeA8YIBOOC6qiMkJz5kmJZR3NxplEVLHVF/k4fc2LL3NxaV2SIUkSphpCWKkKKMo6w2lKMlURKTOlWxRCkmJURVPrIUSFZVaXjKMk5ZCaV1cmd32oukrV7FJNRevs4LqHUl0l05Zub/KSsWzxM4eFJL6///z+vH//eQiIvDdrmkxUAlpEEAoaAfA6Ex2NicPfkUh8EFWLQqj0RQiD+JG52GYI3FspBw+9IckPwLrkySiGidYQyPiQHhsqPGgbwSICchESMNEIkDQOjgqCogHUR1gmQqNpqpzgps5Tev5MR0eVI4irki//vQRPOIBiF9uwHsSPC+L2d2YekSGKH08SYZKIMdvx3Y9iV55eTKNClTLSNk4i0dSI3EVsM1Sa8ks56BualK21j5oEScNIcjLsweVUMhYuSloikmNC6ZJJeNeyGJoyME51FhtRAy9vFtaeptp7//D+lc/7PSk5Eu2qcolbPoFCyTLSNmgAjIopJFOj1mjkqHjOwMbWuaUwRnKJ0f14kMJ5e4zuYcd+w56JI3CdKFpPMAnCcchAFh2DdeV12puEEwfEyYNpgEUOozTm87+govpK8nZWsxIj6q2u6NdQja1kpYyTNi51ARFZkziRWljzjZHQwLlgYUFaaSTMGO3aklVDyyNlaar6b3GFmcJy6aZ/WIfxyDadPVUk1qDo9QQR4m9p0G4lJFDExW2kSIFCA9FGjpRymzzp+lchVtwYjNPSxJxWvCCTGJvUYXbH0gCsRYzmAtrOei4Z50u8PCC+UkqTtMjLKOWBPDf70x2Vj/bJAdR254i8ohVQCucilZS/LhMr/HWUUyOWGyptZVdRJJVpsweaLITqUTBo+SuLavKTLKhtGrqpO0qR0IEiE1EOKH2GF1eeJD4/EZNg8bCwXQgYRIzPZ3pLKnUkUNatVARaSwMvkGVgeQh9nGLJ539ejMoDTZLJYTtII9BT1UmDKrZFMbguwubOWdxI7LW2ED0opM47pXfUzqTPuD4+RtMAm2JJvEiIINnzxlpAwAAgUAuqoIDlKBoOuABJkd7jBRoQoA0MioAoMAGDYBTgmKlSUNBMQkhYlcJQMAGRiEqfJjh81ZliCzS6SypDZpdksZRC5Gq4PAMVANoEjhEfXTSKyEyMUmCJq1kUUKTasmiY2QmVmtgSvQsJZSyrLj2PNE4y4aRg2XMCApaZfqslkRCrJrK1HP5CUGkacChzQ+NIRTRNNXrIVAs2CqEiIoSRWKXET0LGQjlXcnqSnO4wSjWMWvps6hOsyw8oRJqs+hThMiKnpoYskxNyWEc9uRLKsjQWAEbF8WIYhJUZUfVlr192YJL6EsQDQSDhNRO3TT7T+EvwQTY9ZUcJyEyRlhHTFNIVTPCJU8xjWn08bZkteWRmhaRxOqVpgykiNXMMrfEvvZe+zCz//70kT7jFaBfjsJ70ry0i/HZWGJIFiR+O5GMNnDRL7dxPemub1/qwsgSUUm01iZnIa0drevoUZ0/cMlRP4g/FL/upeZXLEUJ5C88jbbPOWaSqLz0p7juRdPzd5xk9WlYrPPprI+xCqttV32Pwp/qI+Yu6U6ecsR5pjI60ScJAU03S7BOYmDoJiiIVwcYUbASkKWg6CCoNEWyIW4/HbxZfKuM2+LGiN8dqZaMmsTR4MzixQlqK3upG/DDt07Xn7CdTAq04nbNDHL4ssCsaI/b4D18wMy4mitLk/b3rDHtHddg2xavFzfy+LmBAhMcaG5xIbFEY3NdQcOMaZ/EbFbVorCYHZ7O4Jaq402NOt8bThDbGG0Vy06Z5co2WQzt0GgsuKwyI0JIZydF0SEkbQGWCAYREBpGT3PdTXpQxSCOMtJszgjLReYWXPsprUi8JJNHl4dL+lZR3r7StMERBMgJlUahPSPzjBKwvgeWA5V5Fph4n36rYvIp9Is5Q+XEZcqqM9BESzIZCMtrbgaKCKAHGC6xOKBslBcBQDiKI8XbeMFkiEwYHP7VZHxcJi49J/ksUROnq2Gl6wx0aTFJCgX0z3rQwrUF4jvri7dD8mVrW+CcYCYrKYkLAaFYwVetmFeu1h9xAYLPGJ6ytoYXNLDq8J6oc3Yl61fLvOmZ0veN1itxhdQ+gyF+b4fq9T3cWt/RQ7sw3vqycaitRZ91do5tN6R+1KShxc/dePVSVcU3kLjw/cfZOukkBGp0QE5RusIFWQp8RlQ5NFJPhBWLH2jfmgqysSUlVPF3s0yfi0mcJbaSKRKDMy+pBto2cLAoiVHCQI2VOnSEmEwmFREIkkRolMilCMoTrDKPXqNFJUvSAmka1uovmfhRhhC2kglE22KniIjQsuEEWm5Eiezp6jSiGZ60PJZKpwQoSEyIXIW6bU6koGsMsxXZtlCTERMkTeUZtY1Gmem1yFdXxUikkpixSez7UtqmLZm05pOVtM0tZNJE2WskfbE3F1ZBACcErJ2WKhwTsLG9gNE1W9Xtb9LqJcJyC3u2O8rml2xEMjaq2C6/SGraTrDa4QlbAYmHscJbfQqQ47VJDdOF4vhtunN3AZHsPMC//vSRO+M1oh+OwnpY/LDT5dhPYkoWYX47ge9NcsuPt3E9iV5jA8uzrTYrJGOJBzDdah5jQ5YfZJmFru5P/SDAxDfxGdahOFU+wHo/WCtip9+rq2zO/gamkzg8o3BqbbRAmspANSUaG/JFrl7j52jixjO2kepc2tkIzmoy5deEnywslNpukd2wzNVNiUZK+kMF2H+bk4pW9xAiJUR8hECyL4anA5kjAfhbAvx9j1HAUh1m+kVO5qCQxo/iXCIZRSEw9Q39ZPY18ReeZaoIyU4NhBcJ5ZGt1cPo4FpDLRmfI1pKqsIGDA5NGWSLk8w2Th4kJW9JHihxGTomGNVuEo9uK2NxUzG7STeqimYKJxH1E0ZvFC5gPIiwRkBapRGVOkaJAOxanTMn4lqd/yTZRWLNEcyqSyrZ9gxBh6aCAfNoifUFLtUzOSO2DFo0TT40+KXdKXEiIu3vq7v/dlUy3tNdg510KhbBUTuWGmzMyNkYYk1AJABalGJwjyKXAEjamSJ0Asu0WULnUbwghJyLLT72jAKisFign0fSZkoqRoGxIZE++DaMjDrDOiAvpg4EC7RZSY3ANkg4KyIlLliAgeJ1BKukcm6UO2ldznNtm6ORXaxzNI0TB1xPB00jrYobDC48o6fTbbczL/6SLn9yeYwo47I9NZAXdeYf9u+2kSl5nGkUidooOL3GLLmTSKi9debzFrJFTr2XW0ti9X1Pc4U3h/c6l3msZ2vaakItvYuqYEIAdg/hYlKX1CD2UcrM4sL9WbP6h+tjO0PY8LLlM+xLiK/U2ZtA5EsQl3U4h8DTTBVVrIo0CpQtRIaQW2iISpshPJiq50cQGjVktIJzZSYf4L9nEM0l5qXZujOoFTYiTSH8JF6IWxongjOIE5mTa72BSWUNnUBAskXJIQLDTnDkWEHCYxFY+TTHIS8jzjJUkoic1zCb1KNHE59uHRZR01yJWnFqA8M6CeD3SQE0QMnmwoDR6D9Mv3hJZoSQI6TYCFlwElUEzegzFhLK7FH+ZMkQ1jmmD0omhm00QmAbAgFxgZLLLB5GRWkQtEs1zMl+42cTZbQNU8yIwCAoIQ0GWnExU2BYYLoiVtAmTdtKIaZRkidJ2z/+9JE6YTF+348yelIgrzvp2E9Jq5Z2fzsDDElg0c/Xcj2JfgdhjaUjK5xI2cK2JmF2dYRlF4kzPVpRGUgwPMIWoLpImHopoSFx8ZgStLGkCsITkyi28urVj0pbFJGwrSEio+TKG0C8CGTB5GQHUkJMgfrDZZ+K9iTNObJG1Do20zLxog3JpUfQBdAKUKPxXQFyzDKORI0HiNIlWwqQBEqCrCGD3E2LCY59HOk0MgtVHLUVPpzofT8dEM6WL2T48O0i1cw/Gmt9Tmyg7K50WTsqLy0YD2yqNbrDJMZlgOmT81i0pMm47g0GsrE02PH1jicgXFSFGYVVvw9XdWoq0wuHomzZx+oXROJONpLpoakW3AmsXbZRrPYJ5F5pzmzI89JHRfVEKziZgVmA+qoGUkBNBNhJUzhQ0Hg/QaPE4kEZQhROcvVxjiSTOSRVNxdREZeYXh0umsyqgmslOSKrYZrKW3cTdE+ooq05stjbkngUMJMG4nlzOSuxaRwoJqhMFfztbEbxL7XbyJXCbkkalpIMUooWYeJSYZNCIKrF9nFJlVJNZO4N6gbJTZPioUaHyQfDiJuaqBU2geLLWjTiq3N5k5HpZ7mm3CZtVu5KOIGVS0WNiRCEaIg+CgrBBckNIWKixLntgYLHstZuOYgJEQpeNiYZKtHUs9lzbHNlxOwfMtG2Tc6yjC+GJTXeosZOrDoLKxQkxsimuSkSvMmkDCM6XamoLFdqmIvOvbLm/xRBiabHkhYrXUCkG4FwhhhsZB1eEbkuH3EYfRiFDMXZi5UujLReb8hQFDDzhIKK5GIx9JzwumJyN5VDBpBMhPgOTkBsqBYJmxtY6jTAsRmhOpBBgeCgoZ0Nis3ZcnN9AghGsybaM6iTb0ftZpJAKEz7TUw8NCgKAbI9WECAoRNqkp1mUUEFmYEopQssCQk8BQwKToDhsbRlw2jkZMHToUKZydvmFG1ksg82vBdG205hSCdOUQJOFDDECJRRZjBaibipix7TQVDO722BFnuac9pUtIfHw3hEsYkAMBFamFAiAoRwgJwpOCU7Wp8jy5yhM3H0nHayNL7O0eUrkNyN1bSGJrrf9uQnqRnLjOnu8mQjIpoFichk//70kTrANZJfruJ7Enwz++nUD0JMlXN+PcmGH8LGj7dyPewAGkuj0vHZlCJ44orPnQBOSgcDkZeCKvBz88k0NJGcU+XOlmMRCYvPlmiqsadbUxeo0WhTVUktZb69MvDF2cc7MSJGxyJk0vnJkfNc0qyJItSOS0Hai52mqyDqKpdHv9Mzpg16nUwuDyhnr0EpBQw6QKUoyCMNJHm8ExRwwOSA4280pu+c7Cg0ERolxvRn/wOu77SU9ovgK2rVY0EYlh8JQQHg5jSy2bPGBePy+8fhEqEhIVS6vOSOftISlSvQ8W2/D4+goy1atWWZ+kOR8k05+FU3mLdvE5DEsPTk7QzxIq4YoinCuxZdhZLctcw7A3WzMT3s1/Dq3Nl1ddHDFjDT7lFyuYGYrTtYMluGtl9WHdegYdccZbfaSJKniAy+j6CDqt2gclOzSX30TlYZbtrs6zQ9j51lnatXApNUqxNVSRZ1olcJKgpUZwmI7GCIukSi0gNiNRRvN0uXqc2G0y5OaTMlEmjcGSORBZK0ZiKniNNR7YdbFY8kgB5QTHxYwTESFUaQ4bTEqRYyzFhi6id6h99Q+ECyb+g+kCVswCLCLSEqTERMTF0JAimznqKRy1yCAYi0gTR75XT4kqxYhKqxOQjuptoSeUz+RIjhpQ9DEPedorCi8GCrM4C6JibUJvNO6LOianiBVOE53FDdZcP/rushjLUWO/3E3zggWQVQIIzACoIsM0XpGCDN6efOOIb1dMx2qZCUaqke34tByw3aWd6yvE9UVGl0yFgFiYLBq0y5CgBYmLLTTXbtg4u09NPqHGCZEYPEsSYeXNC4rKnhgtkalbKkv4mlxSwi1AkmchiNNAHnIWDELm9GqYI0ZCSA8iKimsx0JbHLx0Gka9Sx6Nc6wHhoySsIJITKI2dubTTHnjQACJwEAml10ZGgSQKiDJYXzqwiboomH5kQ3LqQzfCSwNKyMnVKmZlAhx4l2eTBTIm2lOoCEFFCUQKYXJ4SRFfOzFlMZLjkJScVQCh6eGRWj+pNJp40fPK1xqasMJh6Kx0oQSevbRvIL6VjFJ6so0mPlsTB0XiUOTxVEYnK/WzB7F62OicWm0M5TWaWmLh//vSRPQAhgt+PTHvSCLLz8d2PSa+W0H46gw9gEstPt5Y9iYx0SmrFoyjtRpgxVI5eafhKpVQliJAKB4cHAnFcthGH4hiWXzN9h6OreIddLx8ek1EoxqOLHLLjs7TldYscgWmJrQySqaITCQuNRE4tKlpip6e45d567d7qXGLJq0WfKZMfLTymGitWn9Dmlz5EpMjrdrM7yaJETJidp0zLOrH4g66UUhI+SWQB6kwtsitndvYeY+4LX5lC9Ji4rRedrUrTRaxeksymUqjBBFBVKYZDqAOhCWHzIhrKKVqRYZIStOfVVEhBEKxXFwNrlcminKE4lMKEQaWVZjHvRZeTbmtB5AuiMpm4EuSJtVQlnKsMpCh4waTCaRHNVHtQnBWfn5QZyLRyW5dPFVE5kD4tGLQGYqKITqjliwiWgGhUJ7KvhNeVKzhKp1KaKC7lSY4osTLL2z4pV7+ZlxnU1o6yjeWTUFK6AnSWg0xbLLElQAfl/66xw8DBKqZV7nm2hcmSI2ypBI+abJ57N0WSUKkIlGUz5bmyIoiBQENRtFINk4rFZJNtGjaQIITgGDKrJVMyfHx8eJkTTTSAwaiiaXiMXpjUIMOPuNXT2iHDjx6diwc8EjZSWKDAgLqsBgMCgpJqMcm9aT6gw6DoqxnBxklFJUPlyNiN3Pa/RvebJktpyyUluujjHUbfX1SZ+LjytuQpxRHIQ0sBh/MpUbTQAjST5l7f0BYCQCUUJMx6yV1VCjd/Ereu2NX4+O4jk+OA46AmLHV537ri6BIueR2sm2Gp2hn8LVL2u+vegKh4vWKFKczbOCYH750YHFLQNaYDAEDhCNgOK0D3t00kswXXVihshVIdaNLNzFaNvXn1kShaSS69sEBIQRdXhJZ9NJFU1e5zOrsMY4hidTGzlNSkpTMzkEpNbLpJrzR+4baBRBqZsnNo3ePXlqii9xQTQprvRoz80nZF6XStSVPbZTLiNPDBILTlUl7jFDIASg7gGMIyA3D1j9JchqHoYrB0oo/ylOYzzyRZ5GUwRWNC0jlYUzPEO6RZXpkseqwtExgoI6TvNRIJ1wTzhM1xkshWKnO/TDAsFgipFdNhwwUyg0++bVC5Ncy0nH/+9JE6oDVomi9ySZPksSP12A9iX4ekfroB701y2O+nUWHsIGJjfF+0jDmU6bLanFs3drTDRlmhOlREX1+qvW2ZliNLDAV6Y3GjMGm1MIpXlxKVdnfCP7XitTdNM+gqxmSOriaBQ2uGmDSo0CSRREHyJNEEg+SIgqeMrTHTB0P0UJ5IEkki43NsnpyFLjqxAKrSHiMsDiBQcdU0LK6FuLrigILOx182UOxMELD0IwRClEuLkYqbPBYRkqKI1RiEsIgPFrobJyCoMEhpztIOlTs7Qx5PhePyYdB9Lt0F26sXJjhxa84gJVZPuoUlizSQ8ucpU62EtrjyITYRIMHRYpP4HRxGu4hitEOilU9AuLBJTmxKFROerY+c7Uv1q3RmLr1hZV+uWWVVoVSo62d8sbSJD+gsNS6Zm2Lm/hSdzDMKyE7cpx+ZGC9IcNqjpJ5LhP3mFB+8kXMIl6OIwWp/axxKOdzgwiMEzS4yfRzEvOrYw3XXD9E4pS2WsnJSK5nygw/L0tz8405yRCvJyeqDnq1M7rligoqAClpuJJpMSCuO65ReA81x2dTysdO7xmDpPOjBtXWXIkMl0PF8R+9RcumhwoFkL5ynYcTvrKyivUQqdt8d02IanfOSgmFoosQzKMQ5Vk9hE34XRhonXzV8pk1Xfw0+iCUWcQfdt7QUmvEWyK17TqF+7lAoqSswxvlpoPN0eepDnkyBBNMghkb8Q6e8rn4q7Q1H+vnIlB6P3WJQAYBDhGlAW1hRDvcfsmZ3zyCxyqtUK1nXXtM2SuaoKtpQfN5Ey2KCUEw89hzbazC6c28zVEMiBQSE8slRHEG0AlXWttKCBGbIB1GlC8YtbNu9RwteTCl3vQZNtBBtk+tidJtih4kLjwwyjdGdsMyzZ6QPTf1joYjYpE84gDqTzN58GFYkiXph9JsySBqoWilGptLvZZMElMQNTeGJmZn9aNvtuuD6UnCp/shH/29fXeDTioEEFENFQVQDcLU4jFWVcrT3iMyQW2kvqOUZ4z5U6Shn6ilCiVTAUGU9CY1t1HcjzYlK2kJEnH1gcEZWZMzaI+QyfEhxDwtqJJwTCd5TH9x08OUywpHClPctCEjfLpyRj6Mkv/70kTXANTIcj9RhhbgtC/HgT0mrluV+uoHsNnDWL+dQPYmuBzDZcuMM7UJz08K9SiSPvLWIjT1j5hEXGhyNxKBknIZyhwJ3MOYT38V616ISVLRKTPWs9Y6Mn0pVPnupCtJJZWCSYqbU+BcSmDI+23x8+0me5mlXXTlb0f3q2uUMEoxExiTGJGEggJIIphyyckxppSi7td3d1SaIksD5KRcEcRCLL8X9pU6jgMkBqqyTPmGaOfTkhFU5lcPnOssCdJ66O0ZslK7gd4SBaPBYgLFoIYuPFyR9YXWC46hD6kLBWcQ3zxpYpOHGi8kjXLScynRL9y9a9FjDLqFAUljSIvozyqznNQoV6Mult0njwnGgjnIZnolkA7LilObxq0Nk91IZVQQGii0HJTKCkVMkaAE3B4IyJCdYufWQRyNjEihtcJTNqnXTmeiQYgUpR65PYdRkfOo7LnV+b826phNBfI4KUItIEPjGPjEUcQMDaOzTT1zwjN1AOgG/aHCKIOPQtqzmio1GcEcF14I2EbF5PZNvsVKFjyrB4USMtlQaRGXlUfFZAMhdgVkjyVQZOB4TlA3G1nSI1J1xsIpI8jru9G1dPlM9FsaUeYWTQJmXGROHf7ZUmJFmOQePvbYqG+oQg/v62YhhGwNMTKVpad6tUX07qzITUPxP7VkbIpo2EWTgmEFoSabCW3H30PMznS1wprBTmZgoElUQQiqHKUwS8vR0pUvqMXMEew2DURZp4BIAIccF+jb0OhViHMomzaGZLyGREuwKxSRiEuX2EyqMhmDtCofUBtVEM9CTJH50jivFiR7UKRWRfUDVIta37s0aaohZITVGpnJoCzCtGyAVKAtQLPOqD4gEygqQoSzZxFyLaPblXmK5R9zZWYfkVjAjQlyFGrrCqsUfRWWbXXNaRag5+ZNiJxZUsoqSYSKJLFmVWJQRQSqac20LyVRlvpp4yeMORIiZJIiWLdeD4TlOkcxQAieC0Wq6N5VsLZBXUze0s0zx+ftXTS3qxuYZWdmUdmAsl1+jDp7l2DJ/lx0fMnTxN1eWbqLJ3S5JVe5BbLEBTdOoXj2ipa4jTnCUvUWqnkUnfv4shZyF2Fi62DVq5tGlYw9//vSROcAxTh+PkkmH1LDj9dxPMk+Gg386qexNcNnPx1A9ibxhfYWUcXSo8gul430NuEuxCz60iqV7D0cNAwcBM+InQP2hx+hpESWB6S59dhLGydtGGmhJIF0JYmaYWnOJiJRdNEyemXYLpQZXWKMtnjb0CCaaVrbzkSr4EnQdH0CZXFz8RbCqbU1UPmsik9d9g3S3C/DsKIebabCqN5lojpmqPEVunRemM6GZjYVYhp/Ks4WJnZZH3tEt02OSYqIV9VMWbdiYKx/cyYUocej8vKBSJYSicfgeMTwowrI28dMvJhOM1iZ+BfEmX9rlytNVdIjGBOZFWq6I5gPjlaYr6kVYS1o9PKgYoQlj6XoXMx1c+iKz61C41cFrnipE2eDQfDBoBbSBpZKKJNDciazBMD5IiAqIkRjdoGCrjxtUpGnpIUjrKJhQ02uMw6FEVdNErPXGV9QI1kLLZCgWnMl65LVxx7HNyPIC6a6EEHQdoHMY5OTQFS4xRiPCCKYKJAuMMgxQGyP7uY8BxssIjpCRnSM0WMoSJE0fcem1uoWhChETRVk2Lk4nXI2+kMEg88WEhE0MlSyqQuKzKAsyhxl3asrBbvbYhCD9H3mYFFHnUKYpUFTQlGT4LSEROSkguGzIoji6I4VVECxJMVEApOmmpxbF1wqsCzIyhXUdOV7psnVYNYOPPidtlIgMn3xbnSGZbRSgIXEyRLhbVQ22GGDjE/6hB3KTmZs9aJQqYLHVqMFDnVREPJ0ABK1VwDD6ejMdzkwTezGnRMUrj0KzJ5ZtPz1nHkaazSuJoyfYRxFZ9dy00KSKMox3ZJoSyrzWqq0FpgUTgiYBI0yJUBFRJZGDpyWqfs9Jlu2yyRqyMEnUVpGyOEqkiwUwUWNZK89OicFFhMJZS+qNdnOJGhJRKwXmkWJaaiYJwkkWRMBnClgqB3yMtFA7UUDKMK0uTIWlAp5iwAM7CREshKyoAJilUUyAkcy7TJ3hedrksfO/LpBbsSl47Usf15bLsRaIbtxWWu49D/QxBMFR1+ZU5z/R2s4FuDVrP51vHYwiVLOuamXxKRwKwdrTfD5IBKASwNCEgpywHJCNScdkMuCGBJkf0A9YHNMexn/+9JE7IwGYXk7CexJEqDM1+kxJn8cnfruTLE6gsW0X6j2GjnCyxBKz5tsH5KjzWBqJ8SEaCLrSfYfUVCzdB0hLkh8iI4LJwaNTVaaONJsgisKB5eKsiZEdeeFC5y11ZH3yUmchIkcovAVNLiHozS3o6cXIiGT9SbICpRKaQmOCtJCvFnEaiN9zztpdhSo4qk9ZCjJSdQvfTY2p4rIIFa3JG2kxECci2KwIMbjX3lLPsODDh6zx3j1lhOOYULTE9ODg+o2hLSqWiOL27EiNKWlz7srxHeOjQr2O0ejw4STc4RmCwqNMHz1qUVFJnl0LyGUVBLpCvxO06/TnVBBqaU8MTOyrpEsnRY+z84jSYeXyjH2ldqifmQzY90VCb26cHn2D6fSiSBY/CZDRDsl6dKLpBKwu/pwxEmTlkqQRMTx62CM62tbXxQe0hQcgKCOVQApRIkAEXX/HwvqrmWz0sj0uqTUxE5PJZFhalMqhiWRqXVGvM3dFr9K6r8NBZw6jtzlWg62d527TYyVgye6W5d8C5RyQku+4qEFpARFRovRj3E6pE1CAqUhxJa4qQigiXQ1zCcxVGI4GNT+YCuVoVlU8MVnaqXzRW6sWNWeXImGd4mWf5KkxgAylm2igdjLUlylVJ2EMYgu676atGNKwRiyk0ZIXq970zsRLvDLP96dyovj7WTi8P5/l0FfTOdxVprbi0jbciujBmIJp1z9X+CBlAANw6o31lqgrwTzcIlMv5HngduNSmGsI1Jn7dy1JJ6Mypm8y0+GH1gRvZRYldx2Yg5sWcNyFkoJ1Pr/YfbEMW5EgXWlqHi7yK0gi0oDzU7CoD8ZFhI7VzO23OVkLBM4LsuqITZVpVZojSF7aRlkbZPSqi2tkQIMtIE9FkjLBwRxTTpVUoRFRESvMtskazKaba2NeLB+DcWo0tGB5AgVpVWSmTOtwZg1CGKtswbXdx0nZPlF0EMfN6dIm1L6aOc5oGW0KOCsav25eEbUQIHSXQFaLEHxNOesyxfl2osKEF1QAWq9TB5fW5yiv1bVvKxQwDjKeYTz/WKaknYN+XXrMldWYn4tLJRGWTy55Y1Add9gIJyXTHHiEDE3kVhSHDCBInFDBf/70kT6iNaEe707DDay34/HgmHp0lht9PhMJNqLQr8ehYSbYcSEhwLoUANLkjw0RpqhYPuI2UC4OhkeOlzQshH5EaI9KByKCd6YkvVgVZpOrhPnEkEjyCQGhCAZDL4OmxD0RaijQM7s5grW8p2rFU9L30xNBqN0/zTT2PQhjfuEEDix7bc2e0SfyGT7/TouM6nKIl9bwzqfNc7HTSGJgn8YcyQpYuhFd/s7MdjN+Wy6RZUmMA08pw1FmlclUoycGch6w7sAwdJpfTP5QS1a8+8rXnjl71IqQK4YwFI5t4pCVzgQOY8GJkIsJDhWCgmbywSXVDImVQkKFJUZAlZUnyK5BFhlAMoWokS59pCNG4EyBEYJgum9Aqq1FKBD1GS4MQHGdB0/pyBJNFNRl8QOQRMQu9Xd8QUBFIhSaAtGiKnJcLDLvr0gTHVKh8jz1LJ0TtowFAR6G3r90KFBwDibKDPdFP9WcQR/wefv7whuASeLwCLWEAPKmPOm/BK5n6F34OdWJPxL3ilUbpljUkeavLZPUm1B4/DMEvovF23965Uof5czHY5LWJF3mTKZrXhZiQLitXSNTph99krVtF0l9ryVjcicha80clBG0VuNxvUDmVRyGS1FvTxeEa+O8q0eNx4wIcr0IUDYcp0NqhocCGNCCbG5+jUMel+P05DBYUJRanSbatHfo95VEo4KIUKqJtpRHM5nSfi4eJZFK9kLiqTijjeLmbp/RjuSD4bp+sjAnnyHHMTaySXJyboT1TL7UX2B/KoDY3w45Mbm1h4WJYExMXqCSiXLS90LRTMztcwfoZmuH2AS1UD0ZrAPypQYoTCGpfdNxqNyStLiks0XoUKc/sYGSpMjeSJHBAOm5QFEK3HrK3XZtRl/LsWr/Ka2+y/NfKeYL7KLMomQJoDnNRRNMtJE6qpK0xKyhjE4USZMYhqTOGEj84vbDTWXB5fbqtK27eYl4GJSNVqZHqv7eTe3QupMRlxwztVhHrVa+ufDLcGh1lU1lLV2VYeuVvHqGSPlJfynKVGKmxeapZxGNo1l2m5Q9S8tMmbZvKKBX8ht9rspdp5onD0chugT2N7o7GERZY/2EYa47VogGi9JLlsquxcy//vSZOiNCMF+O4tPZ0J9D5fmGMNuYM3+8Ay9mkG+vh9UkIyhNvuqokG4blItqaxB4FsPImycmK5Bm8jULU0JJx0edTwXBLw4cNTUUOEEdDpWkHk9D5CZII6KyCflEZrjkuoDJGIwbkOphc/JYUJgA05UPRSIzR+hlAhjuuLzRZbRjmTSfZdEWS0fkwvtoita5uPw+GBqVkhecKq1ETLj8oJo+oRyglSEiig1WHZ+bD8tX3bV3utLZwXKwp3jI5oQFzi5o4aNDyKTjjBQcnlTsknx8dwM+rQZaPFWHbRvxXEsj4fcwVIHlx1IllV7Y/GgwBsfu36kaacpsZI1WNYXak5ukyBtKIw4uusXR6Uyc2Iu8M0z7U9HaLnRT2Y98nee7lVh/GCIS+cLTdCfRzpoXuPrpZOMWfzsBapz+simbpK5O8mRu9hZaaSllCIkMpoDOPaZcDJkR5uXJb1wecoqIAzIVRJ1GMA+uSAkYX7hldj8L1Vgi6y4cVy+TipYT75NeZ40+rCoZRFRCBs0PzBgO6uZn7dZ6Ay37sKY2G6s3GQv84byQ0RBYETOWYLLYEHGcQLkai+4wdTJsMKYA2R+HvR4iiAJGhgvh5pU/zNLq2DTLYpD1YyFCEOBfjsJGT9XkrM80miCLmWM1CVnufZpmmyJgNWVRfW83xbUcq1GmzyTqcVCwYarLebzEoz0Vpby/G4OJcH4OE/ycltJYQ9iLApEefBJSKRygTqteFTVtjiLpZSlafijN9j0O8lyXhiyCaFuJCdLCZY7mMRar8sz7cEOnUzCwKyNGLkPtgOlRPXR1s7AcxdD9dm9CKI/zISi0Sk+yxvmdTnstohCHJWNxfGsgiQMVW0MQ70+bCIWDnLQsD9sOo70MO1oVTbKMGYAzR3sKJi6G5TZN2/J+xLpRdLZubGToLDuwxmLMG+7hEe6nqG4uyg8rWQxcEG77nYsQyrbUJkkBNgZmRUqmFpwSQPMHnjEH+bcYkc80S0zhktod8GgsCamdpZmxKpONapujYVzoKZ0LXQGYRSJ65poIKFUrmDg9nQzDIaJ2ClwOLwdGYVSwZTw5FaeJS7cbkVM6MguQNvjzQPInCXKZGId5u3LO1f/+9Jk8o357366i5h9MntPZ9AMI5Bfnfr0TTE9Aai7X4CQjAGdiStKcu6yoKA36T/fGmjEigNy4885WJXk1WbeR5mMpDutAcVa1OxRyjISyeYrkZufD2VEadZEWGUrSDcTwIrCigYLUa1eyuGtpcbnKINjwtQiFJHAmfHx+kPBLTytSQFQRzCpFCk5II2HlMfwJCu2IC4wEQcy+sWQFJk8Pj4QaryrxcWOCGcLDEsH1ictbXWHoMrLCIDj+LFLPQE4Ksqit7Bj3MyYikyjNmnTG0SJduBxFkhKGXIEY6hJxU3B6E0ToYitg+sGRNARGHFbYJMHEhEaWG/LszOhnyH/tGfmvEOWw7YOUFES+/fP7KSPY07WnMuI/zkyybVYphjsN+R5AzBBWW0+8Jmsu+DRjSWS7f9LhsahIds8ERR1Jmbb+1OL1UwuMZpVQ7k1y1JatONr1UyaUMGpqHq3SwLVACAJSRpEg8BUJZR3fhiVVX6lEbppVAMBP6/VFHJRFbm70Yk9lAPL0vS/ohWTyjrcGfq7j4kYWsUtVyBj05Aaai6vRDcFKFBZZOLJhl3AaPB7LEPQx4s6iih3RyReV29SFaqg8RXoQnAi5bzIJiwFsD5DYLqdq0j04d0RlNchBTF2jl0Q81V2n4RMqo3RLkAox9jpeD+PEv4/ixMhgsqfEu52IhKMjITC2hDgPYSk1kOQ6KRyRHx7Q0unJyZCWXTsvj4ORWDplt12xICweTI5XwGUBIeKvF48KxXcUpU632EComqI5qsLpkqZK1Safa3Lrt1jOvNlZiLM2C2bzWHtFD0LBxDaKOkHrTz8vN5102hcVH9EZABnBMl/LPJQ8NqGIqzZTKhmIaleWZOd2zq06ZfSkC5LndJZpS/UbllICXGcCHYSOwldhVdo5LFqpY4oIzRAa7WicjRUU8j+BAbqKD59aOMGjWwIzQxgvqFGhKaDsH2eZkHxKPtCEc8FDwZQYlhjqFUnDD5nOrTUJb2UGCIcasEMQNIFUKRmvRYMwApxokkFeAiBCwk1LIfgqrPTDsymKxuvQPXB8Bw5Jp2S3I7KxYOBbS+7zcIalj8DBKtD6pVp/rrJlJSTEIxMFUirQYbpEP/70GTyAPijfj1TL2ciie/XsBhD4CFR+vTsvT0CFb1ewGMNeeignyGBFrF3NLRxWY+zwF2GQMiVeyJYRsq6Uq2eqNnjK1Smgng0DYOwwl2o2M200dDx1RVy3ipww1GzH8X1iViFGihhN2dWGixPz/bj7PtzSBoQUcSJFoxImlCc1Eg0YoFtbVrQ2Jxg3U+lAiFQqI/P1FH4idljmleoezuKHMaZaVyuluKrkIcx5dxI1YDrIWjLSlsljFdFk5La4RkShGZNrCgUxSONrsISiFOSFC2/aw/NzaHx38pEgY5Gu3FkpaBlRLvuxgoA4VQl5ilHpQ2l7pwOrEj7nlHmtybHw0nwUbCaMRWHeglwSt4pWZguFjai5Q8RBIdPeDmjjNTzNnMywgisD1COlUYmBlReaUWCHNiGhoTFYgbXgVZHPNyQzFrWYpbULRsHEsJT7zYGkXqQxMPVVYJR0D8HmPIbw1GNi7Q6QiKKo+Al8iogBMSShiMYgkch+G+gh3nKeeRxpw2tM/ZhMPBMs1ht84Yib2v+7Ltu3Va7MRVuCHJS2lfGHQqDHg68EZsQgI71sUHuSxOBFiMuZahjAD8tpTP1DyR7hP+5SWSuJcqkShZOop1IUdZanUqSTGEWE/ToOkshyGoPcqjvLqVSHkMcCxIlTk/OMqCZDyVTSZI/y7m5K3HMg2AzS/qpWn+pFOZKgO9C4x/EvmQ9Zqd6HK5EG+oC5IdBPVDzEiF/KVFu3Ai13ZRI8pU0oUmdy8qjqcspSTJIxLWYoD0SjscV8ZPFCoT4fJNVI7Hpi6VS6XDoc7FRdYeVkYdC4mDyTR9Vw2PYxSIK0zKw5j40sJ5fMB3Cs+XERIXE5iPq8wKyc8mNMTnjstLw0AIAApoEtLM2p2oQt3yJzJM04aLLtMWaJGNV0c2AavTBZk0dhOqgoa8MS6tW4clYm3jmzuQxWncrYvEUdErsTwFTAiy87OnHIq/W8fDhiGuwjVyxAe5GYQnR5uWRy5Vmh5rDNKDHY6fUImIETxLu/rQaBgdIg4Yh+DqgeZifAsEGmfWSoft1ZTLXsfNsOdPF40uaT24xAMNSCCnlZk487I4rBzpTUWjDhRmVsxccVLX/+9Jk6g25JH47i09nQnuvV7UYwwBeufzyLL2ZAbg73sBgjWEcZosRWIGabTAWZKV9uJCpT0K+6rfG6qI6pOhaYlErlFMlmo3Z1XAYk2pYTEqUIc3ySORXHCm36kVjWqARg3XZpJSKuVs3CmTLap5lieBGgNa5cG2LEgjwI+pHSSNPVH984apxo9GixPsp0za01UHKQ5jburWlNhcVaRLll1qwySwRwo1y8TD5xGX3X0qRtWvYaZbPDCqYlW5l1k5x9s9XbLOWLa41hykLbEssuVtCewOMZ+OmPQuJitGeK1JlGVnqxBlZrNc+jozAECQQNMDbro+TjLnCu7xN7C2v1B3jc9DL1zGDZ+ZqR3yNXRi41ux5afajQmjZ1CClcr1FhoZ0LCuUXwRtcyl++f5raGLPLKuqEPc8nsILNdKGNTIyNQzzOW4byw5FmSHq4cBzN52PBASAAGPfHPiGnBIyqYFli7yKSK0mnn1YasVQFFVXL8/EpWw1xZbEn+kTtQqpDTWlTMua016Wvsw5lZjlpwH5phMJTRcaaWGXVI2krpf1W1BMsZxotTRqGnaYdOX6WrDLuv6wFUrOp6rYhqHqaJO0/tJTspZbKGVKmizostoJtnKsxlIXSXdFYlIoZljlQ9Kq9aNX6sZxqtZXa7TlOVDzhOtMy2mhqTv7qIs5fm4+z+8jrOXdlsMs5WFfq1WyiT/Q9KpdcjWXZVLqzhLDO67LWXFf1yWsu67IEgJAOPrlUmnvQnJiYnNCUuj63jyIp4fbm0XHRkSjIyfKxO+y6bQkkSkZypqtYEInQkT9WnJi61VkxEw37C8P29LLtarajQAASAAAIBY4kCIsHQciZUYWOdGZVJNVSVPdryh8+TVlDUKtckVprVdgQqzDGR6wwzH2lgICsoYUcRs4pMeuwqkZFlgNkAhV8UNtsdXq8cqoUeoGY5sVUSCAh6qxAar0BDGjBhUZtnFUsarLA8laZpbZm7GB0bFquu0e3/CipsWuUxAbWihZsoVNYJREZixES+BY5hsFsJ0e4hqNLsOKO2qnsL2Chqpx4T7eH0a6djPYuNwUNVNbZi+E+levbNWXetouXc08cu1ri6tc9mJr8y20Ov/70mT4BYjwfjgzWGZik++nKCBo2ljh6MIHsfnLCD0YlYSwAXmeadaeZ6yUSTFd/NHQJB8lPZqtdaf46J3TXpZMURKQiday75hMYVNt6ZZW3OT2ltdy66F2WnmXZ11p5mB6qaJkmuHRkjOSalJokntTk9qc/i4yeSqSsTqLlzZ6wuucwrTFg+sdLjKl4ua1rWtrQnz58xHMcwtqGEKUSufRrWrlOsiqUqynm+cSJhQqgFSBMWEI2YBICQNSzWrJJJq05e9l1p61ySqmazCYu1nErsJiw8121q09h0ZGKEJR8uXLv5kxW5CtxkxXMu5a0zaq0xJsC79dZouhWsLoyTepypXPWwlLZt8C6zUZ0ZLjI+jrZnaraPVqythJJ6tWrXDJ+31rASj61swlCM9M4dLa9WZna29KTXF3siCZLl3s9vWxc2YxPJXCUezWYXcZdnLWta1rVrWrK05EkcQBiWB09Wra1rbCUvPSsqMWIhxMQU1FMy4xMDCqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
const GHOST_DATA_URI    = 'data:audio/mp4;base64,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ZQAAAWoAAAFwAAABbwAAAXUAAAFyAAABdAAAAXQAAAFzAAABcwAAAXQAAAF0AAABgQAAAWcAAAFyAAABcwAAAXQAAAF2AAABeAAAAZcAAAFrAAABawAAAXQAAAF1AAABcgAAAXwAAAGDAAABZwAAAW0AAAGRAAABbwAAAYIAAAFxAAABbgAAAYEAAAF0AAABcgAAAWwAAAFuAAABZgAAAWkAAAFpAAABbwAAAXYAAAFzAAABcAAAAXgAAAF9AAABnAAAAXYAAAFxAAABdQAAAWsAAAF/AAABcgAAAYMAAAFtAAABbQAAAXkAAAGBAAABbwAAAWsAAAFvAAABbgAAAW4AAAG2AAABZwAAAW8AAAFsAAABewAAAWgAAAFqAAABpgAAAWsAAAFtAAABbgAAAaYAAAFpAAABYgAAAeMAAAFeAAABZwAAAWYAAAG7AAABlgAAAVgAAAGdAAABbgAAAVQAAAFgAAABcgAAAaUAAAFIAAABewAAAXIAAAFSAAABWAAAAWMAAAHIAAABUAAAAVgAAAFXAAABhAAAAVwAAAFdAAABggAAAWMAAAFsAAABcQAAAacAAAGKAAABXwAAAbkAAAFoAAABXQAAAVkAAAFwAAABZgAAAWYAAAGEAAABdgAAAV8AAAFhAAABZwAAAYIAAAFmAAABZwAAAb0AAAFiAAABZAAAAWsAAAF0AAABZQAAAWEAAAF+AAABeQAAAW8AAAFuAAABgQAAAXEAAAFoAAABgAAAAWQAAAFrAAABZQAAAckAAAFyAAABYgAAAWwAAAFmAAABagAAAWMAAAF2AAABaQAAAWMAAAFwAAABaAAAAWwAAAFxAAABbAAAAWcAAAFqAAABbgAAAWkAAAF3AAABaQAAAW0AAAFjAAABaQAAAWcAAAF8AAABagAAAXQAAAFzAAABjAAAAZEAAAE+AAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwAAAXQAAAFzAAABdAAAAXMAAAF0AAABcwACSsRtZGF0Cg4AAAAkxP/fIJ9EBAQE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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHchEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdSEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3iwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAByIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHIhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8hEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdyEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHohEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHUhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcCEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcCEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH0hEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHYhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAciEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcyEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB1IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABzIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH4hEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHohEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdyEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB6IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHYhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHUhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAdSEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB6IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHshEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHUhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcSEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB9IRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABzIRAFAKAb/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN6cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHEhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3p4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHMhEAUAoBv/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3pwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfCEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADengAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeiEQBQCgG//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4AAAAbm1mcmEAAAArdGZyYQEAAAAAAAABAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAUtAQEBAAAAK3RmcmEBAAAAAAAAAgAAAAAAAAABAAAAAAAAAAAAAAAAAAAFLQEBAQAAABBtZnJvAAAAAAAAAG4=';

const SOUND_URLS = {
  ambience:   'https://cdn.pixabay.com/download/audio/2022/03/15/audio_2e5b4f6c6d.mp3?filename=dark-ambient-110997.mp3',
  panic:      'https://cdn.pixabay.com/download/audio/2022/10/30/audio_5b8b1b0d65.mp3?filename=horror-swell-124320.mp3',
  steps:      STEPS_DATA_URI,
  ghostVoice: GHOST_DATA_URI,
};

// Distance at which ghost voice starts playing (entering zone area)
const GHOST_VOICE_RANGE = 200;
const THEMES = [
  {
    title:'THE MAZE',
    bg:'#030c06',       // deep dark base
    bg2:'#071410',      // secondary bg layer
    tile:'#061209',     // floor tile color
    tileAlt:'#07150b',  // alternating tile
    wall:'#0d1f10',     // wall fill
    wallInner:'#050e07',// wall inner shadow
    wallGlow:'#1e5525', // wall edge glow
    edge:'#1a4820',     // wall border
    accent:'#3bd46a',
    vignette:'rgba(0,0,0,0.72)',
    dust:'rgba(60,200,90,0.06)',
    alertColor:'#ffcc00',
    chaseColor:'#ff2244',
  },
  {
    title:'THE UPPER FLOOR',
    bg:'#03040e',
    bg2:'#060a1a',
    tile:'#050818',
    tileAlt:'#060a1c',
    wall:'#0b1030',
    wallInner:'#040614',
    wallGlow:'#1c2a70',
    edge:'#1a2260',
    accent:'#3b6cff',
    vignette:'rgba(0,0,0,0.74)',
    dust:'rgba(60,90,255,0.05)',
    alertColor:'#ffcc00',
    chaseColor:'#ff2244',
  },
  {
    title:'THE ATTIC',
    bg:'#0d0306',
    bg2:'#180510',
    tile:'#120408',
    tileAlt:'#14040a',
    wall:'#220a14',
    wallInner:'#0e0308',
    wallGlow:'#5a1a30',
    edge:'#481428',
    accent:'#ff3b8d',
    vignette:'rgba(0,0,0,0.76)',
    dust:'rgba(255,50,120,0.05)',
    alertColor:'#ffcc00',
    chaseColor:'#ff4400',
  },
  {
    title:'NO ESCAPE',
    bg:'#0c0001',
    bg2:'#1a0003',
    tile:'#0f0102',
    tileAlt:'#110102',
    wall:'#2a0006',
    wallInner:'#0a0001',
    wallGlow:'#801020',
    edge:'#660012',
    accent:'#ff3b3b',
    vignette:'rgba(0,0,0,0.78)',
    dust:'rgba(255,0,30,0.06)',
    alertColor:'#ff8800',
    chaseColor:'#ff0000',
  },
];
const SKINS   = [{l:'Ivory',c:'#fde8cc'},{l:'Cream',c:'#f5cda0'},{l:'Warm',c:'#e8a870'},{l:'Tan',c:'#c47830'},{l:'Mocha',c:'#8a4a18'}];
const HAIRS   = [{l:'Jet',c:'#1a1008'},{l:'Brown',c:'#3a1a0a'},{l:'Chestnut',c:'#6a2e10'},{l:'Auburn',c:'#8c3a0a'},{l:'Caramel',c:'#c07830'},{l:'Honey',c:'#cc9828'},{l:'Platinum',c:'#e8dab8'},{l:'Ash',c:'#b0a890'},{l:'Red',c:'#8a1010'},{l:'Rose',c:'#cc3377'},{l:'Violet',c:'#6622aa'},{l:'Blue',c:'#1a55cc'}];
const OUTFITS = [{l:'Navy',c:'#1a3a78'},{l:'Scarlet',c:'#882020'},{l:'Forest',c:'#1a5a2a'},{l:'Plum',c:'#6a1a78'},{l:'Gold',c:'#c49010'},{l:'Teal',c:'#0a5a5a'},{l:'Rose',c:'#aa2255'},{l:'Rust',c:'#8a3010'},{l:'Sky',c:'#1a6aaa'},{l:'Olive',c:'#5a6a20'}];
const EYES    = [{l:'Dark',c:'#1a1010'},{l:'Hazel',c:'#7a5020'},{l:'Amber',c:'#aa7010'},{l:'Green',c:'#1a6a20'},{l:'Teal',c:'#0a6a60'},{l:'Blue',c:'#1a40aa'},{l:'Grey',c:'#4a5a6a'},{l:'Violet',c:'#5a2a8a'}];
const BOY_STYLES  = ['Short','Spiky','Buzz','Side','Curly','Mohawk'];
const GIRL_STYLES = ['Long','Ponytail','Pigtails','Bob','Bun','Wavy'];
const GIRL_ACC    = [{l:'None',v:'none'},{l:'Bow',v:'bow'},{l:'Tiara',v:'tiara'},{l:'Band',v:'band'},{l:'Flower',v:'flower'}];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function dist(ax,ay,bx,by){const dx=ax-bx,dy=ay-by;return Math.sqrt(dx*dx+dy*dy);}
function aabbOverlap(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
function circleRect(cx,cy,cr,rx,ry,rw,rh){const nx=clamp(cx,rx,rx+rw),ny=clamp(cy,ry,ry+rh),dx=cx-nx,dy=cy-ny;return dx*dx+dy*dy<cr*cr;}
function dk(hex,a){if(!hex||hex[0]!=='#')return hex;const h=hex.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16),k=1-a;return `rgb(${Math.max(0,~~(r*k))},${Math.max(0,~~(g*k))},${Math.max(0,~~(b*k))})`;} 
function lt(hex,a){if(!hex||hex[0]!=='#')return hex;const h=hex.replace('#',''),r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return `rgb(${Math.min(255,~~(r+(255-r)*a))},${Math.min(255,~~(g+(255-g)*a))},${Math.min(255,~~(b+(255-b)*a))})`;} 
async function safeLoadLoop(uri,vol=0.6){try{if(!Audio)return null;const{sound}=await Audio.Sound.createAsync({uri},{shouldPlay:false,isLooping:true,volume:vol});return sound;}catch{return null;}}
async function safePlay(s){try{if(s)await s.playAsync();}catch(e){/* ignore */}}
async function safeVol(s,v){try{if(s)await s.setVolumeAsync(clamp(v,0,1));}catch(e){/* ignore */}}
async function safeUnload(s){try{if(s)await s.unloadAsync();}catch(e){/* ignore */}}

function makeRng(seed){
  let s=seed|0||Date.now();
  return()=>{s=(s^(s<<13))>>>0;s=(s^(s>>17))>>>0;s=(s^(s<<5))>>>0;return(s>>>0)/4294967296;};
}

function generateMaze(seed, cols, rows, cellW, cellH, offsetX, offsetY, wallT){
  const rng=makeRng(seed);
  // visited grid and passage flags: passages[r][c] = {right:bool, down:bool}
  const visited=Array.from({length:rows},()=>new Array(cols).fill(false));
  const right  =Array.from({length:rows},()=>new Array(cols).fill(false)); // passage to right
  const down   =Array.from({length:rows},()=>new Array(cols).fill(false)); // passage down

  function carve(r,c){
    visited[r][c]=true;
    const dirs=[[0,1,'r'],[0,-1,'l'],[1,0,'d'],[-1,0,'u']];
    // shuffle
    for(let i=dirs.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[dirs[i],dirs[j]]=[dirs[j],dirs[i]];}
    for(const[dr,dc,d] of dirs){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&!visited[nr][nc]){
        if(d==='r')right[r][c]=true;
        else if(d==='l')right[nr][nc]=true;
        else if(d==='d')down[r][c]=true;
        else if(d==='u')down[nr][nc]=true;
        carve(nr,nc);
      }
    }
  }
  carve(0,0);

  const walls=[];
  const W=cellW,H=cellH,T=wallT;
  const ox=offsetX,oy=offsetY;

  // Border walls
  walls.push({x:ox,             y:oy,              w:cols*W+T, h:T});  // top
  walls.push({x:ox,             y:oy+rows*H,       w:cols*W+T, h:T});  // bottom
  walls.push({x:ox,             y:oy,              w:T,        h:rows*H+T}); // left
  walls.push({x:ox+cols*W,      y:oy,              w:T,        h:rows*H+T}); // right

  // Interior walls — draw right and bottom walls of each cell if no passage
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const x=ox+c*W, y=oy+r*H;
      // Right wall (between cell and cell+1 to the right)
      if(c<cols-1&&!right[r][c]){
        walls.push({x:x+W, y:y, w:T, h:H+T});
      }
      // Bottom wall
      if(r<rows-1&&!down[r][c]){
        walls.push({x:x, y:y+H, w:W+T, h:T});
      }
    }
  }
  return walls;
}

// Pick a random cell center, avoiding the border strip
function cellCenter(col,row,cellW,cellH,offsetX,offsetY,wallT){
  return{
    x: offsetX + col*cellW + Math.floor(cellW/2),
    y: offsetY + row*cellH + Math.floor(cellH/2),
  };
}

function buildFloors(){
  // Every call generates a brand-new maze layout with random floor ordering and random themes
  // Seed combines time + random to guarantee uniqueness even if called in the same millisecond
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFF)) >>> 0;
  const rng=makeRng(seed+999);

  // ── DIFFICULTY TIERS (di = 0 easiest → 3 hardest) ──────────────────────────
  // Each tier has clearly distinct maze size, ghost count, ghost type, zone size,
  // item availability and key distance — all solvable but noticeably harder.
  //
  //  di=0  EASY   : small maze, 2 slow ghosts, generous items, key nearby
  //  di=1  MEDIUM : medium maze, 3 normal ghosts, moderate items
  //  di=2  HARD   : large maze, 4 normal ghosts with bigger zones
  //  di=3  BRUTAL : huge maze, 4 FAST ghosts, very large zones, scarce items
  //
  const configs=[
    // di=0 EASY
    {cols:10,rows:5, cellW:300,cellH:260, ox:32,oy:32, wallT:30,
     numGhosts:2, ghostKinds:['NORMAL','NORMAL'], zoneBase:320, zonePerDi:0,
     numPush:2, hasBandage:true, hasFreeze:true, hasShield:false, hasSpeed:true, hasKill:false,
     minKeyDistMult:0.18, diffLabel:'EASY'},
    // di=1 MEDIUM
    {cols:14,rows:7, cellW:220,cellH:196, ox:32,oy:32, wallT:26,
     numGhosts:3, ghostKinds:['NORMAL','NORMAL','NORMAL'], zoneBase:380, zonePerDi:30,
     numPush:2, hasBandage:true, hasFreeze:true, hasShield:true, hasSpeed:false, hasKill:false,
     minKeyDistMult:0.22, diffLabel:'MEDIUM'},
    // di=2 HARD
    {cols:18,rows:8, cellW:174,cellH:168, ox:32,oy:32, wallT:24,
     numGhosts:4, ghostKinds:['NORMAL','NORMAL','NORMAL','NORMAL'], zoneBase:440, zonePerDi:50,
     numPush:1, hasBandage:true, hasFreeze:true, hasShield:true, hasSpeed:false, hasKill:true,
     minKeyDistMult:0.26, diffLabel:'HARD'},
    // di=3 BRUTAL
    {cols:22,rows:10, cellW:144,cellH:138, ox:32,oy:32, wallT:22,
     numGhosts:4, ghostKinds:['NORMAL','FAST','NORMAL','FAST'], zoneBase:500, zonePerDi:60,
     numPush:1, hasBandage:false, hasFreeze:true, hasShield:true, hasSpeed:false, hasKill:true,
     minKeyDistMult:0.30, diffLabel:'BRUTAL'},
  ];

  // Fully shuffle which difficulty appears in which floor slot each run
  // → First floor is NEVER guaranteed to be easy; could be brutal
  const diffOrder=[0,1,2,3];
  for(let i=diffOrder.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    [diffOrder[i],diffOrder[j]]=[diffOrder[j],diffOrder[i]];
  }

  // Shuffle theme order independently
  const themeOrder=[0,1,2,3];
  for(let i=themeOrder.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    [themeOrder[i],themeOrder[j]]=[themeOrder[j],themeOrder[i]];
  }

  // Shuffle the visit order: which slot index you visit first, second, third, fourth
  const visitOrder=[0,1,2,3];
  for(let i=visitOrder.length-1;i>0;i--){
    const j=Math.floor(rng()*(i+1));
    [visitOrder[i],visitOrder[j]]=[visitOrder[j],visitOrder[i]];
  }

  // PHASE FLOOR: one random floor slot gets exactly 1 wall-phasing ghost
  const phaseFloorSlot = Math.floor(rng() * 4);

  // fi = encounter order (0-3), di = difficulty tier for that slot
  const floors = diffOrder.map((di, fi)=>{
    const cfg=configs[di];
    const{cols,rows,cellW,cellH,ox,oy,wallT}=cfg;
    const floorSeed = seed + fi*7919 + Math.floor(rng()*100000);
    const floorRng = makeRng(floorSeed+42);
    const ri=(max)=>Math.floor(floorRng()*max);
    const walls=generateMaze(floorSeed, cols,rows,cellW,cellH,ox,oy,wallT);

    // Spawn + elevator — bottom-right corner
    const spCol=Math.max(cols-2,1), spRow=Math.max(rows-2,1);
    const spC=cellCenter(spCol,spRow,cellW,cellH,ox,oy,wallT);
    const spawn={x:spC.x, y:spC.y};
    const elevC=spC;
    const elevator={x:elevC.x-70, y:elevC.y-60, w:140, h:120};
    const escapeDoor=null;

    // Key — forced far from spawn (harder tiers push it even further)
    let keyCol=ri(Math.floor(cols/2));
    let keyRow=ri(Math.floor(rows/2));
    let keyCell=cellCenter(keyCol,keyRow,cellW,cellH,ox,oy,wallT);
    const minKeyDist=Math.max(300, (cols*cellW+rows*cellH)*cfg.minKeyDistMult);
    let ktries=0;
    while(ktries<80 && dist(keyCell.x,keyCell.y,spawn.x,spawn.y)<minKeyDist){
      ktries++;
      keyCol=ri(Math.floor(cols/2));
      keyRow=ri(Math.floor(rows/2));
      keyCell=cellCenter(keyCol,keyRow,cellW,cellH,ox,oy,wallT);
    }
    const key={x:keyCell.x, y:keyCell.y};

    // Bandage
    const bandage=(()=>{
      if(!cfg.hasBandage) return null;
      let bCol=Math.floor(cols/2)+ri(3)-1, bRow=Math.floor(rows/2)+ri(2)-1;
      bCol=clamp(bCol,1,cols-1); bRow=clamp(bRow,1,rows-1);
      const bc=cellCenter(bCol,bRow,cellW,cellH,ox,oy,wallT);
      return {x:bc.x, y:bc.y, taken:false};
    })();

    // Freeze gun
    const freezeGun=(()=>{
      if(!cfg.hasFreeze) return null;
      let fzCol=ri(Math.floor(cols/2)), fzRow=ri(rows);
      let fzCell=cellCenter(fzCol,fzRow,cellW,cellH,ox,oy,wallT);
      let fzT=0;
      while(fzT<50 && dist(fzCell.x,fzCell.y,spawn.x,spawn.y)<280){
        fzT++; fzCol=ri(cols); fzRow=ri(rows);
        fzCell=cellCenter(clamp(fzCol,0,cols-1),clamp(fzRow,0,rows-1),cellW,cellH,ox,oy,wallT);
      }
      return {x:fzCell.x, y:fzCell.y, taken:false};
    })();

    // Kill orb
    const killOrb=(()=>{
      if(!cfg.hasKill) return null;
      const kc=cellCenter(cols-1-ri(4), rows-1-ri(3), cellW,cellH,ox,oy,wallT);
      return {x:kc.x, y:kc.y, taken:false};
    })();

    // Speed boost
    const speedBoost=(()=>{
      if(!cfg.hasSpeed) return null;
      const sc=cellCenter(ri(cols), rows-1-ri(2), cellW,cellH,ox,oy,wallT);
      return {x:sc.x, y:sc.y, taken:false};
    })();

    // Shield
    const shieldPower=(()=>{
      if(!cfg.hasShield) return null;
      const shC=cellCenter(ri(cols), 1+ri(Math.max(1,rows-2)), cellW,cellH,ox,oy,wallT);
      return {x:shC.x, y:shC.y, taken:false};
    })();

    // Push pickups
    const pushPickups=[];
    for(let pp=0;pp<cfg.numPush;pp++){
      const ppCol=pp===0?ri(Math.floor(cols/2)):Math.floor(cols/2)+ri(Math.floor(cols/2));
      const ppRow=pp===0?Math.floor(rows/3)+ri(Math.floor(rows/3)):ri(Math.floor(rows/2));
      const ppC=cellCenter(clamp(ppCol,0,cols-1),clamp(ppRow,0,rows-1),cellW,cellH,ox,oy,wallT);
      if(dist(ppC.x,ppC.y,spawn.x,spawn.y)>180) pushPickups.push({x:ppC.x,y:ppC.y,taken:false});
    }

    // M4.2: Scattered coin pickups (3–5 per floor) — physical coins player walks over
    const coinPickups=[];
    const COIN_COUNT=3+ri(3);
    for(let ci=0;ci<COIN_COUNT;ci++){
      let cCol=ri(cols),cRow=ri(rows);
      let cC=cellCenter(clamp(cCol,0,cols-1),clamp(cRow,0,rows-1),cellW,cellH,ox,oy,wallT);
      let ct=0;
      while(ct<40&&(dist(cC.x,cC.y,spawn.x,spawn.y)<180||coinPickups.some(p=>dist(p.x,p.y,cC.x,cC.y)<90))){
        ct++;cCol=ri(cols);cRow=ri(rows);
        cC=cellCenter(clamp(cCol,0,cols-1),clamp(cRow,0,rows-1),cellW,cellH,ox,oy,wallT);
      }
      coinPickups.push({x:cC.x,y:cC.y,taken:false});
    }

    // Ghosts — 5 quadrant zones so all counts work cleanly
    const quadrants=[
      [Math.floor(cols/2)+1, cols-1, 0,                    Math.floor(rows/2)],    // top-right
      [Math.floor(cols/2)+1, cols-1, Math.floor(rows/2)+1, rows-1],                // bottom-right
      [1,     Math.floor(cols/2),    Math.floor(rows/2)+1, rows-1],                // bottom-left
      [1,     Math.floor(cols/2),    0,                    Math.floor(rows/2)],     // top-left
      [Math.floor(cols/4),   Math.floor(cols*3/4), Math.floor(rows/4), Math.floor(rows*3/4)], // center
    ];
    const zoneRadius=cfg.zoneBase + di*cfg.zonePerDi;
    const enemies=[];
    for(let g=0;g<cfg.numGhosts;g++){
      const q=quadrants[g%quadrants.length];
      let gc=q[0]+ri(Math.max(1,q[1]-q[0]+1));
      let gr=q[2]+ri(Math.max(1,q[3]-q[2]+1));
      let ec=cellCenter(gc,gr,cellW,cellH,ox,oy,wallT);
      let tries=0;
      while(tries<40 && (dist(ec.x,ec.y,spawn.x,spawn.y)<380 || dist(ec.x,ec.y,elevC.x,elevC.y)<380)){
        tries++;
        gc=q[0]+ri(Math.max(1,q[1]-q[0]+1));
        gr=q[2]+ri(Math.max(1,q[3]-q[2]+1));
        ec=cellCenter(gc,gr,cellW,cellH,ox,oy,wallT);
      }
      const p1c=cellCenter(Math.max(q[0],gc-2),Math.max(q[2],gr-1),cellW,cellH,ox,oy,wallT);
      const p2c=cellCenter(Math.min(q[1],gc+2),Math.min(q[3],gr+1),cellW,cellH,ox,oy,wallT);
      enemies.push({
        x:ec.x, y:ec.y,
        patrol:[{x:p1c.x,y:p1c.y},{x:p2c.x,y:p2c.y}],
        patrolIndex:0,
        kind: cfg.ghostKinds[g % cfg.ghostKinds.length],
        zone:{cx:ec.x, cy:ec.y, r:zoneRadius},
        state:'patrol', alertUntil:0, frozenUntil:0,
      });
    }

    // ── PHASE FLOOR override: exactly 1 wall-phasing ghost, no others ──
    const isPhaseFloor = fi === phaseFloorSlot;
    let finalEnemies = enemies;
    if(isPhaseFloor){
      // Place PHASE ghost near map center, away from spawn
      const pcCol = Math.max(1, Math.min(cols-2, Math.floor(cols/4) + ri(Math.floor(cols/4))));
      const pcRow = Math.max(1, Math.min(rows-2, Math.floor(rows/4) + ri(Math.floor(rows/4))));
      const pc = cellCenter(pcCol, pcRow, cellW, cellH, ox, oy, wallT);
      const pa = cellCenter(clamp(pcCol-2,1,cols-2), clamp(pcRow-1,1,rows-2), cellW, cellH, ox, oy, wallT);
      const pb = cellCenter(clamp(pcCol+2,1,cols-2), clamp(pcRow+1,1,rows-2), cellW, cellH, ox, oy, wallT);
      finalEnemies = [{
        x:pc.x, y:pc.y,
        patrol:[{x:pa.x,y:pa.y},{x:pb.x,y:pb.y}],
        patrolIndex:0,
        kind:'PHASE',           // passes through all walls
        zone:{cx:pc.x,cy:pc.y,r:zoneRadius*1.3},
        state:'patrol', alertUntil:0, frozenUntil:0,
      }];
    }

    return{
      id:fi+1,
      diffIdx:di,
      diffLabel: isPhaseFloor ? 'HAUNTED' : cfg.diffLabel,
      theme:themeOrder[fi],
      walls,
      elevator,
      escapeDoor,
      key,
      bandage,
      freezeGun,
      killOrb,
      speedBoost,
      shieldPower,
      pushPickups,
      coinPickups,
      enemies: finalEnemies,
      hasPhaseGhost: isPhaseFloor,
      spawn,
    };
  });
  return {floors, visitOrder};
}

function FloorBackground({ theme, zoom }) {
  const TILE = 120; // world units per tile — bigger for 2400×1600 world
  const cols = Math.ceil(WORLD_W / TILE) + 1;
  const rows = Math.ceil(WORLD_H / TILE) + 1;
  const tiles = [];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const alt = (r+c)%2===0;
      tiles.push(
        <View key={`t${r}_${c}`} style={{
          position:'absolute',
          left:c*TILE*zoom, top:r*TILE*zoom,
          width:TILE*zoom, height:TILE*zoom,
          backgroundColor: alt ? theme.tile : theme.tileAlt,
          borderWidth: 0.5,
          borderColor:'rgba(255,255,255,0.025)',
        }}/>
      );
    }
  }
  // grunge scratch lines (decorative, static)
  const scratches = [
    {x1:200,y1:80, x2:350,y2:140},
    {x1:600,y1:300,x2:680,y2:280},
    {x1:900,y1:600,x2:1000,y2:650},
    {x1:400,y1:700,x2:500,y2:720},
    {x1:1100,y1:200,x2:1200,y2:190},
    {x1:750,y1:450,x2:820,y2:480},
  ];
  return (
    <View style={{position:'absolute',left:0,top:0,width:WORLD_W*zoom,height:WORLD_H*zoom}}>
      {tiles}
      {/* Scratch / grunge lines */}
      <Svg style={{position:'absolute',left:0,top:0}} width={WORLD_W*zoom} height={WORLD_H*zoom}>
        {scratches.map((s,i)=>(
          <Line key={i}
            x1={s.x1*zoom} y1={s.y1*zoom} x2={s.x2*zoom} y2={s.y2*zoom}
            stroke="rgba(255,255,255,0.04)" strokeWidth={zoom*1.5} strokeLinecap="round"/>
        ))}
        {/* Random dot "debris" */}
        {[{x:180,y:340},{x:480,y:160},{x:820,y:550},{x:1050,y:400},{x:600,y:750},{x:1200,y:650},{x:300,y:700},{x:900,y:200}].map((d,i)=>(
          <Circle key={`d${i}`} cx={d.x*zoom} cy={d.y*zoom} r={zoom*2.5} fill="rgba(255,255,255,0.035)"/>
        ))}
      </Svg>
    </View>
  );
}

function WallBlock({ w, theme, zoom }) {
  const x=w.x*zoom, y=w.y*zoom, ww=w.w*zoom, hh=w.h*zoom;
  const isBorder = (w.w>=2400||w.h>=1600||w.w>=900||w.h>=900);
  const cornerR = isBorder ? 0 : 5;
  return (
    <View style={{position:'absolute', left:x, top:y, width:ww, height:hh, borderRadius:cornerR, overflow:'hidden'}}>
      {/* Base fill */}
      <View style={{position:'absolute',inset:0,backgroundColor:theme.wall,borderRadius:cornerR}}/>
      {/* Top highlight edge */}
      <View style={{position:'absolute',left:0,top:0,right:0,height:isBorder?2:Math.max(2,hh*0.08),
        backgroundColor:theme.wallGlow,opacity:0.55,borderTopLeftRadius:cornerR,borderTopRightRadius:cornerR}}/>
      {/* Left highlight edge */}
      <View style={{position:'absolute',left:0,top:0,bottom:0,width:isBorder?2:Math.max(2,ww*0.06),
        backgroundColor:theme.wallGlow,opacity:0.35,borderTopLeftRadius:cornerR,borderBottomLeftRadius:cornerR}}/>
      {/* Inner dark */}
      <View style={{position:'absolute',left:isBorder?1:3,top:isBorder?1:3,right:isBorder?1:3,bottom:isBorder?1:3,
        backgroundColor:theme.wallInner,opacity:0.55,borderRadius:Math.max(0,cornerR-2)}}/>
      {/* Outer border glow */}
      <View style={{position:'absolute',inset:0,borderRadius:cornerR,
        borderWidth:isBorder?2:1,borderColor:theme.edge,opacity:isBorder?0.6:0.85}}/>
    </View>
  );
}

function GhostSprite({ state, kind, zoom, isFrozen=false }) {
  const isPanic = kind==='PANIC';
  const isFast  = kind==='FAST';
  const isPhase = kind==='PHASE';
  const bodyColor  = isFrozen ? '#88ccff' : isPanic ? '#cc2288' : isPhase ? '#88aaff' : isFast&&state==='chase' ? '#ff0066' : state==='chase' ? '#ff1133' : state==='alert' ? '#ff8800' : isFast?'#ff88cc':'#c8c0e8';
  const glowColor  = isFrozen ? 'rgba(100,200,255,0.35)' : isPanic ? 'rgba(200,30,130,0.4)' : isPhase ? 'rgba(80,120,255,0.30)' : state==='chase' ? 'rgba(255,10,40,0.45)' : state==='alert' ? 'rgba(255,140,0,0.35)' : 'rgba(160,140,220,0.18)';
  const eyeColor   = isFrozen ? '#aaddff' : isPhase ? '#aaccff' : state==='chase' ? '#ff0000' : state==='alert' ? '#ffcc00' : '#0a0820';
  const r = ENEMY_R * zoom;

  // ── IMAGE GHOST MODE ───────────────────────────────────────────────────────
  const ghostImg = GHOST_IMAGE_REGISTRY[kind] ?? GHOST_IMAGE_REGISTRY['NORMAL'];
  if(ghostImg){
    const tint = isFrozen?'rgba(100,200,255,0.4)':isPhase?'rgba(80,120,255,0.20)':state==='chase'?'rgba(255,30,50,0.25)':state==='alert'?'rgba(255,140,0,0.2)':undefined;
    return(
      <View style={{width:r*6.5,height:r*6.5,alignItems:'center',justifyContent:'center',opacity:isPhase?0.72:1}}>
        <View style={{position:'absolute',width:r*6.5,height:r*6.5,borderRadius:r*3.25,backgroundColor:glowColor}}/>
        <SafeImage source={ghostImg} style={{width:r*6.0,height:r*6.0,opacity:isFrozen?0.7:0.95}} resizeMode="contain"/>
        {(state!=='patrol'||isFrozen)&&(
          <View style={{position:'absolute',top:-r*0.5,alignSelf:'center',
            backgroundColor:isFrozen?'rgba(40,120,200,0.85)':isPhase?'rgba(40,80,200,0.85)':state==='chase'?'rgba(200,0,20,0.85)':'rgba(180,100,0,0.85)',
            paddingHorizontal:4,paddingVertical:1,borderRadius:4}}>
            <Text style={{color:'white',fontSize:r*0.55,fontWeight:'900',fontFamily:'monospace',letterSpacing:1}}>
              {isFrozen?'*':isPhase&&state==='chase'?'∞':state==='chase'?'!':'?'}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // ── SVG GHOST MODE (default) ───────────────────────────────────────────────
  return (
    <View style={{width:r*2.8, height:r*2.8, alignItems:'center', justifyContent:'center'}}>
      {/* Zone pulse glow */}
      <View style={{
        position:'absolute',
        width:r*2.8, height:r*2.8, borderRadius:r*1.4,
        backgroundColor:glowColor,
      }}/>
      {/* Body */}
      <Svg width={r*2} height={r*2.4} style={{position:'absolute'}}>
        {/* Ghost body */}
        <Path
          d={`M${r*0.15},${r} Q${r*0.15},${r*0.1} ${r},${r*0.15} Q${r*1.85},${r*0.1} ${r*1.85},${r} L${r*1.85},${r*1.75} Q${r*1.6},${r*1.55} ${r*1.4},${r*1.75} Q${r*1.2},${r*1.95} ${r},${r*1.75} Q${r*0.8},${r*1.95} ${r*0.6},${r*1.75} Q${r*0.4},${r*1.55} ${r*0.15},${r*1.75} Z`}
          fill={bodyColor}
          opacity={0.93}
        />
        {/* Eyes */}
        <Circle cx={r*0.68} cy={r*0.85} r={r*0.22} fill={eyeColor}/>
        <Circle cx={r*1.32} cy={r*0.85} r={r*0.22} fill={eyeColor}/>
        {/* Eye shine */}
        <Circle cx={r*0.72} cy={r*0.8} r={r*0.08} fill="white" opacity={state==='patrol'?0.8:0.3}/>
        <Circle cx={r*1.36} cy={r*0.8} r={r*0.08} fill="white" opacity={state==='patrol'?0.8:0.3}/>
        {/* Mouth — changes per state */}
        {state==='chase'
          ? <Path d={`M${r*0.6},${r*1.15} Q${r},${r*1.45} ${r*1.4},${r*1.15}`} stroke="rgba(0,0,0,0.7)" strokeWidth={r*0.12} fill="none" strokeLinecap="round"/>
          : state==='alert'
          ? <Path d={`M${r*0.65},${r*1.2} L${r*1.35},${r*1.2}`} stroke="rgba(0,0,0,0.6)" strokeWidth={r*0.1} fill="none" strokeLinecap="round"/>
          : <Path d={`M${r*0.65},${r*1.15} Q${r},${r*1.3} ${r*1.35},${r*1.15}`} stroke="rgba(0,0,0,0.5)" strokeWidth={r*0.1} fill="none" strokeLinecap="round"/>
        }
      </Svg>
      {/* State badge */}
      {(state!=='patrol'||isFrozen)&&(
        <View style={{
          position:'absolute', top:-r*0.5, alignSelf:'center',
          backgroundColor: isFrozen?'rgba(40,120,200,0.85)':state==='chase'?'rgba(200,0,20,0.85)':'rgba(180,100,0,0.85)',
          paddingHorizontal:4, paddingVertical:1, borderRadius:4,
        }}>
          <Text style={{color:'white',fontSize:r*0.55,fontWeight:'900',fontFamily:'monospace',letterSpacing:1}}>
            {isFrozen?'❄':state==='chase'?'!':'?'}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GHOST TERRITORY ZONE RING  (visible faint circle on the floor)
// ─────────────────────────────────────────────────────────────────────────────
function GhostZoneRing({ zone, state, theme, zoom }) {
  const cx=zone.cx*zoom, cy=zone.cy*zoom, r=zone.r*zoom;
  const color = state==='chase' ? theme.chaseColor : state==='alert' ? theme.alertColor : theme.accent;
  const opacity = state==='patrol' ? 0.07 : state==='alert' ? 0.18 : 0.28;
  return (
    <Svg style={{position:'absolute',left:0,top:0,pointerEvents:'none'}} width={WORLD_W*zoom} height={WORLD_H*zoom}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={zoom*2} opacity={opacity} strokeDasharray={`${zoom*12} ${zoom*8}`}/>
      <Circle cx={cx} cy={cy} r={r*0.15} fill={color} opacity={opacity*0.8}/>
    </Svg>
  );
}

function PauseModal({visible,onExit,onContinue,keysCount,floorNum,elapsedMs,pushCharges,shieldCharges,shieldArmed}){
  const anim=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(visible){
      Animated.timing(anim,{toValue:1,duration:180,useNativeDriver:true}).start();
    }else{
      Animated.timing(anim,{toValue:0,duration:160,useNativeDriver:true}).start();
    }
  },[visible,anim]);

  if(!visible)return null;

  const backdropOpacity=anim.interpolate({inputRange:[0,1],outputRange:[0,0.6]});
  const cardTranslate=anim.interpolate({inputRange:[0,1],outputRange:[20,0]});
  const cardScale=anim.interpolate({inputRange:[0,1],outputRange:[0.96,1]});

  const t=Math.floor((elapsedMs||0)/1000);
  const mm=Math.floor(t/60), ss=t%60;
  const timeStr=`${mm}:${ss<10?'0':''}${ss}`;

  const StatPill=({label,val,color='#e8dcc8'})=>(
    <View style={{flex:1,alignItems:'center',gap:3,paddingVertical:8,borderRadius:10,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'}}>
      <Text style={{color:'rgba(255,255,255,0.35)',fontFamily:'monospace',fontSize:8,letterSpacing:2}}>{label}</Text>
      <Text style={{color,fontFamily:'monospace',fontWeight:'900',fontSize:15}}>{val}</Text>
    </View>
  );

  return(
    <View pointerEvents="auto" style={{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center'}}>
      <Animated.View style={{position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'black',opacity:backdropOpacity}}/>
      <Animated.View style={{
        width:'86%',maxWidth:360,
        borderRadius:18,padding:16,
        backgroundColor:'rgba(8,7,18,0.96)',
        borderWidth:1.5,borderColor:'rgba(255,255,255,0.12)',
        transform:[{translateY:cardTranslate},{scale:cardScale}],
      }}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',letterSpacing:4,fontSize:13}}>PAUSED</Text>
          <Text style={{fontSize:18}}>⏸</Text>
        </View>

        {/* Stats grid */}
        <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
          <StatPill label="FLOOR" val={`${floorNum}`} color="#c9a44c"/>
          <StatPill label="KEYS" val={`${keysCount}/4`} color={keysCount===4?'#00ff88':'#d6c8ff'}/>
          <StatPill label="TIME" val={timeStr} color="#88ccff"/>
        </View>
        <View style={{flexDirection:'row',gap:8,marginBottom:14}}>
          <StatPill label="PUSH" val={`💥 ${pushCharges}`} color={pushCharges>0?'#ff8844':'rgba(255,120,60,0.4)'}/>
          <StatPill label="SHIELD" val={shieldCharges>0?(shieldArmed?'🛡 ARMED':'🛡 '+shieldCharges):'🛡 —'} color={shieldCharges>0?'#44ccff':'rgba(100,180,220,0.35)'}/>
        </View>

        <Text style={{color:'rgba(255,255,255,0.40)',fontFamily:'monospace',fontSize:10,lineHeight:16,marginBottom:14}}>
          Leaving will NOT save your progress.
        </Text>

        <View style={{flexDirection:'row',gap:10}}>
          <TouchableOpacity onPress={onExit} activeOpacity={0.85}
            style={{flex:1,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,90,120,0.16)',borderWidth:1.5,borderColor:'rgba(255,90,120,0.55)'}}>
            <Text style={{color:'rgba(255,160,180,0.95)',fontFamily:'monospace',fontWeight:'900',letterSpacing:2}}>EXIT</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onContinue} activeOpacity={0.85}
            style={{flex:1,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(214,200,255,0.14)',borderWidth:1.5,borderColor:'rgba(214,200,255,0.65)'}}>
            <Text style={{color:'#d6c8ff',fontFamily:'monospace',fontWeight:'900',letterSpacing:2}}>CONTINUE</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function CaptureOverlay({visible,title,progress01,accent}){
  if(!visible)return null;
  const size=66,r=26,c=2*Math.PI*r,dashOffset=c*(1-clamp(progress01,0,1));
  return(
    <View style={SS.captureWrap} pointerEvents="none">
      <View style={SS.captureCard}>
        <Text style={SS.captureTitle}>{title}</Text>
        <View style={{height:10}}/>
        <Svg width={size} height={size}>
          <Circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth="6" fill="none"/>
          <Circle cx={size/2} cy={size/2} r={r} stroke={accent} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={dashOffset} transform={`rotate(-90 ${size/2} ${size/2})`}/>
        </Svg>
        <View style={{height:10}}/>
        <Text style={SS.capturePct}>{Math.round(progress01*100)}%</Text>
        <Text style={SS.captureSub}>Hold to complete</Text>
      </View>
    </View>
  );
}
function ElevatorDoorsOverlay({visible,progress,label}){
  if(!visible)return null;
  const leftX=progress.interpolate({inputRange:[0,1],outputRange:[-220,0]});
  const rightX=progress.interpolate({inputRange:[0,1],outputRange:[220,0]});
  const fade=progress.interpolate({inputRange:[0,0.6,1],outputRange:[0,0.7,0.98]});
  const edgeL=progress.interpolate({inputRange:[0,1],outputRange:[0,1]});
  return(
    <View style={SS.doorsWrap} pointerEvents="none">
      {/* Dark shade behind doors */}
      <Animated.View style={[SS.doorShade,{opacity:fade}]}/>
      {/* Left door panel */}
      <Animated.View style={[SS.doorPanel,SS.doorLeft,{transform:[{translateX:leftX}]}]}>
        <View style={{position:'absolute',top:0,bottom:0,right:0,width:3,backgroundColor:'rgba(180,160,255,0.25)'}}/>
        <View style={{position:'absolute',top:'20%',bottom:'20%',right:14,width:2,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:1}}/>
        <View style={{position:'absolute',top:'35%',bottom:'35%',right:22,width:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:1}}/>
      </Animated.View>
      {/* Right door panel */}
      <Animated.View style={[SS.doorPanel,SS.doorRight,{transform:[{translateX:rightX}]}]}>
        <View style={{position:'absolute',top:0,bottom:0,left:0,width:3,backgroundColor:'rgba(180,160,255,0.25)'}}/>
        <View style={{position:'absolute',top:'20%',bottom:'20%',left:14,width:2,backgroundColor:'rgba(255,255,255,0.06)',borderRadius:1}}/>
        <View style={{position:'absolute',top:'35%',bottom:'35%',left:22,width:1,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:1}}/>
      </Animated.View>
      {/* Label */}
      <View style={SS.doorLabelWrap}><Text style={SS.doorLabel}>{label}</Text></View>
    </View>
  );
}
function HeartRow({hearts,maxH=5}){
  return(
    <View style={{flexDirection:'row',gap:4,flexWrap:'wrap',maxWidth:90}}>
      {Array.from({length:maxH}).map((_,i)=>(
        <View key={i} style={{width:13,height:13,borderRadius:3,
          backgroundColor:i<hearts?'#ff3355':'#2a1a1a',
          borderWidth:1,borderColor:i<hearts?'#ff6677':'#3a1a1a'}}/>
      ))}
    </View>
  );
}
// ═════════════════════════════════════════════════════════════════════════════
//  IMAGE ASSETS
//  On iOS/Android (Expo Go): require() works perfectly — assets are bundled by Metro.
//  On Expo Snack web preview: the web bundler may not resolve local PNGs.
//  Since target platforms are iOS and Android, we use direct requires.
//  SafeImage handles any null gracefully if an asset is somehow missing.
// ═════════════════════════════════════════════════════════════════════════════

let IMG_CHAR2  = null; try { IMG_CHAR2  = require('./assets/char2.png');  } catch(e) {}
let IMG_CHAR3  = null; try { IMG_CHAR3  = require('./assets/char3.png');  } catch(e) {}
let IMG_CHAR4  = null; try { IMG_CHAR4  = require('./assets/char4.png');  } catch(e) {}
let IMG_CHAR5  = null; try { IMG_CHAR5  = require('./assets/char5.png');  } catch(e) {}
let IMG_CHAR6  = null; try { IMG_CHAR6  = require('./assets/char6.png');  } catch(e) {}
let IMG_CHAR7  = null; try { IMG_CHAR7  = require('./assets/char7.png');  } catch(e) {}
let IMG_CHAR8  = null; try { IMG_CHAR8  = require('./assets/0_Citizen-Women_Run_Throwing_001-removebg-preview.png'); } catch(e) {}
let IMG_CHAR9  = null; try { IMG_CHAR9  = require('./assets/0_Citizen-Women_Running_002-removebg-preview.png');      } catch(e) {}
let IMG_CHAR10 = null; try { IMG_CHAR10 = require('./assets/0_Fallen_Angels_Running_007-removebg-preview.png');      } catch(e) {}
let IMG_FREEZE = null; try { IMG_FREEZE = require('./assets/freeze.png'); } catch(e) {}
let IMG_PUSH   = null; try { IMG_PUSH   = require('./assets/push.png');   } catch(e) {}
let IMG_COIN   = null; try { IMG_COIN   = require('./assets/coin.png');   } catch(e) {}
let IMG_GHOST1 = null; try { IMG_GHOST1 = require('./assets/ghost1.png'); } catch(e) {}
let IMG_GHOST2 = null; try { IMG_GHOST2 = require('./assets/ghost2.png'); } catch(e) {}
let IMG_GHOST3 = null; try { IMG_GHOST3 = require('./assets/ghost3.png'); } catch(e) {}

/**
 * SafeImage — renders an Image only when source is non-null.
 * Falls back to an optional fallback element (default: transparent View).
 * Prevents crashes when an asset file is absent in Expo Snack.
 */
const SafeImage = ({source, style, resizeMode='contain', fallback=null}) => {
  if(!source) return fallback || <View style={style}/>;
  return <Image source={source} style={style} resizeMode={resizeMode}/>;
};

// ═════════════════════════════════════════════════════════════════════════════
//  CHARACTER & GHOST REGISTRY
//  ─────────────────────────────────────────────────────────────────────────
//  HOW TO ADD YOUR OWN CHARACTERS IN EXPO SNACK:
//
//  1. In Snack, click the "+" icon next to the Files panel on the left.
//  2. Create a folder:  assets/characters/
//  3. Upload your PNG files, e.g.
//       assets/characters/character.png
//       assets/characters/character1.png
//  4. Add an entry to CHARACTER_REGISTRY below, for example:
//       {
//         id: 'hero',
//         name: 'HERO',
//         accentColor: '#60a8ff',
//         bgColor: '#0a0e1a',
//         borderColor: '#2a3a5a',
//         sub: 'brave & fast',
//         // Point to your file with require():
//         spriteImage: require('./assets/characters/character.png'),
//         // spriteSize controls how wide/tall the image appears (in game units)
//         spriteWidth: 36,
//         spriteHeight: 72,
//         // Fallback SVG charData if image fails to load:
//         fallback: {gender:'boy',skin:'#f5cda0',hairColor:'#1a1008',outfit:'#1a3a78',eyeColor:'#1a40aa',hairStyle:'Short',accessory:'none'},
//       },
//
//  HOW TO ADD GHOST IMAGES:
//  1. Upload your ghost PNGs to  assets/ghosts/
//  2. Add entries to GHOST_IMAGE_REGISTRY below, matching ghost 'kind':
//       NORMAL → assets/ghosts/ghost.png
//       FAST   → assets/ghosts/ghost_fast.png (optional)
//
//  Note: In Snack web preview, images must be hosted URLs or require() bundled assets.
//  If you paste the file directly in Snack, use require('./assets/characters/yourfile.png')
// ═════════════════════════════════════════════════════════════════════════════

// ── PLAYER CHARACTER REGISTRY ─────────────────────────────────────────────────
// Each entry uses the embedded base64 image defined above.
const CHARACTER_REGISTRY = [
  {
    id: 'wildling',
    name: 'WILDLING',
    accentColor: '#5dbd3a',
    bgColor: '#0a1408',
    borderColor: '#2a4a10',
    sub: 'forest survivor',
    spriteImage: IMG_CHAR2,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'boy',skin:'#e8a870',hairColor:'#2a5010',outfit:'#5a3010',eyeColor:'#1a6a20',hairStyle:'Curly',accessory:'none'},
  },
  {
    id: 'hooded',
    name: 'HOODED',
    accentColor: '#7ab83a',
    bgColor: '#0a1208',
    borderColor: '#304810',
    sub: 'green cloak',
    spriteImage: IMG_CHAR3,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'boy',skin:'#e8a870',hairColor:'#3a1a0a',outfit:'#3a5010',eyeColor:'#0a6a60',hairStyle:'Short',accessory:'none'},
  },
  {
    id: 'viking',
    name: 'VIKING',
    accentColor: '#c9a44c',
    bgColor: '#100c04',
    borderColor: '#4a3a10',
    sub: 'horn helmet',
    spriteImage: IMG_CHAR4,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'boy',skin:'#c47830',hairColor:'#6a2e10',outfit:'#1a5a2a',eyeColor:'#1a6a20',hairStyle:'Buzz',accessory:'none'},
  },
  {
    id: 'elven',
    name: 'ELVEN',
    accentColor: '#c8b890',
    bgColor: '#100e08',
    borderColor: '#4a3a20',
    sub: 'owl armor',
    spriteImage: IMG_CHAR5,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#fde8cc',hairColor:'#6a4a20',outfit:'#5a4a20',eyeColor:'#7a5020',hairStyle:'Bob',accessory:'none'},
  },
  {
    id: 'valkyrie',
    name: 'VALKYRIE',
    accentColor: '#88aacc',
    bgColor: '#080c12',
    borderColor: '#2a3a50',
    sub: 'silver blade',
    spriteImage: IMG_CHAR6,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#fde8cc',hairColor:'#c0c8c8',outfit:'#3a4a5a',eyeColor:'#1a40aa',hairStyle:'Ponytail',accessory:'band'},
  },
  {
    id: 'shieldmaiden',
    name: 'SHIELDMAIDEN',
    accentColor: '#aaaaaa',
    bgColor: '#0c0c0c',
    borderColor: '#3a3a3a',
    sub: 'iron guard',
    spriteImage: IMG_CHAR7,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#e8a870',hairColor:'#b0a890',outfit:'#5a5a5a',eyeColor:'#0a6a60',hairStyle:'Wavy',accessory:'none'},
  },
  {
    id: 'tribal',
    name: 'TRIBAL',
    accentColor: '#38d8c0',
    bgColor: '#081412',
    borderColor: '#1a4a44',
    sub: 'spirit thrower',
    spriteImage: IMG_CHAR8,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#c07850',hairColor:'#3a1a08',outfit:'#38d8c0',eyeColor:'#18b8a0',hairStyle:'Bob',accessory:'band'},
  },
  {
    id: 'ranger',
    name: 'RANGER',
    accentColor: '#7ab83a',
    bgColor: '#081208',
    borderColor: '#2a4a18',
    sub: 'field operative',
    spriteImage: IMG_CHAR9,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#f0d090',hairColor:'#d0a830',outfit:'#4a7820',eyeColor:'#2a5a18',hairStyle:'Ponytail',accessory:'none'},
  },
  {
    id: 'wraith',
    name: 'WRAITH',
    accentColor: '#8899bb',
    bgColor: '#08080e',
    borderColor: '#2a2a40',
    sub: 'fallen shadow',
    spriteImage: IMG_CHAR10,
    spriteWidth: 100, spriteHeight: 100,
    fallback: {gender:'girl',skin:'#b8b8c8',hairColor:'#1a1a28',outfit:'#2a2a38',eyeColor:'#88aaff',hairStyle:'Short',accessory:'none'},
  },
];

// ── GHOST IMAGE REGISTRY ───────────────────────────────────────────────────────
// Ghost images are now embedded. Each kind maps to one of the 3 ghost sprites.
// NORMAL = stone golem (ghost1), FAST = ice demon (ghost2), PANIC = skull reaper (ghost3)
const GHOST_IMAGE_REGISTRY = {
  NORMAL: IMG_GHOST1,  // stone/moss golem — slow patrol ghost
  FAST:   IMG_GHOST2,  // ice crystal demon — fast chasing ghost
  PANIC:  IMG_GHOST3,  // skull reaper — panic mode ghost
};

// ─────────────────────────────────────────────────────────────────────────────
function ChibiCharacter({charData,size=1,flip=false,opacity=1}){
  if(!charData)return null;

  // ── IMAGE SPRITE MODE ─────────────────────────────────────────────────────
  // If charData has a spriteImage (from CHARACTER_REGISTRY), render it as Image
  if(charData.spriteImage){
    const W=(charData.spriteWidth||36)*size;
    const H=(charData.spriteHeight||72)*size;
    return(
      <Image
        source={charData.spriteImage}
        style={{
          width:W, height:H, opacity,
          transform:flip?[{scaleX:-1}]:[],
        }}
        resizeMode="contain"
      />
    );
  }

  // ── SVG CHIBI MODE (default) ──────────────────────────────────────────────
  const{gender,skin,hairColor,outfit,eyeColor,hairStyle,accessory='none'}=charData;
  const isGirl=gender==='girl';
  const hd=dk(hairColor,0.32),hl=lt(hairColor,0.42);
  const od=dk(outfit,0.30),ol=lt(outfit,0.35);
  const sd=dk(skin,0.22),sl=lt(skin,0.28);
  const W=36*size,H=72*size;

  if(isGirl){
    const GirlHairBack=()=>{
      if(hairStyle==='Long'||hairStyle==='Wavy')return(<G><Path d="M19,27 Q10,38 9,62 Q8,80 12,91 Q15,97 20,94 Q18,80 18,62 Q18,42 21,29 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M45,27 Q54,38 55,62 Q56,80 52,91 Q49,97 44,94 Q46,80 46,62 Q46,42 43,29 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M11,44 Q10,62 10.5,78" stroke={hl} strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round"/><Path d="M53,44 Q54,62 53.5,78" stroke={hl} strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round"/>{hairStyle==='Wavy'&&<><Path d="M9,50 Q6,56 9,62 Q6,68 9,74" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/><Path d="M55,50 Q58,56 55,62 Q58,68 55,74" stroke={hairColor} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7"/></>}</G>);
      if(hairStyle==='Ponytail')return(<G><Path d="M44,28 Q58,24 62,42 Q66,60 58,76 Q54,84 49,82 Q51,68 53,54 Q55,40 49,32 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M56,44 Q58,60 56,72" stroke={hl} strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round"/></G>);
      if(hairStyle==='Pigtails')return(<G><Path d="M16,28 Q3,33 2,50 Q1,68 7,78 Q10,84 15,82 Q13,70 13,56 Q13,41 17,30 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M48,28 Q61,33 62,50 Q63,68 57,78 Q54,84 49,82 Q51,70 51,56 Q51,41 47,30 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/></G>);
      if(hairStyle==='Bob')return(<G><Path d="M17,28 Q13,40 13,53 Q14,64 22,70 Q13,66 12,55 Q12,40 17,28 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M47,28 Q51,40 51,53 Q50,64 42,70 Q51,66 52,55 Q52,40 47,28 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M22,70 Q32,76 32,76 Q32,76 42,70" stroke={hairColor} strokeWidth="10" fill="none" strokeLinecap="round"/></G>);
      return null;
    };
    const GirlHairFront=()=>{
      const cap=(<G><Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,17 32,15 Q20,17 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M20,22 Q26,12 32,10 Q38,12 44,22" stroke={hl} strokeWidth="2" fill="none" opacity="0.45" strokeLinecap="round"/><Path d="M18,18 Q22,10 26,11" stroke={hl} strokeWidth="1.3" fill="none" opacity="0.3" strokeLinecap="round"/></G>);
      if(hairStyle==='Bun')return<G>{cap}<Circle cx="32" cy="5" r="11" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M22,5 Q32,-5 42,5 Q42,14 32,17 Q22,14 22,5 Z" fill={hd} opacity="0.2"/><Path d="M23,3 Q32,-1 41,3" stroke={hl} strokeWidth="2" fill="none" opacity="0.4" strokeLinecap="round"/><Circle cx="26" cy="1" r="4.5" fill={hl} opacity="0.3"/></G>;
      if(hairStyle==='Bob')return<G>{cap}<Path d="M18,29 Q16,41 16,52 Q16,63 23,67 Q14,64 13,53 Q13,39 18,29 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M46,29 Q48,41 48,52 Q48,63 41,67 Q50,64 51,53 Q51,39 46,29 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M23,67 Q32,73 32,73 Q32,73 41,67" stroke={hairColor} strokeWidth="9" fill="none" strokeLinecap="round"/></G>;
      if(hairStyle==='Ponytail')return<G>{cap}<Ellipse cx="45" cy="26" rx="6" ry="6" fill={outfit} stroke={hd} strokeWidth="1"/><Ellipse cx="45" cy="26" rx="3.5" ry="3.5" fill={ol}/><Circle cx="44" cy="25" r="1.5" fill="rgba(255,255,255,0.6)"/></G>;
      if(hairStyle==='Pigtails')return<G>{cap}<Ellipse cx="17" cy="27" rx="6" ry="6" fill={outfit} stroke={hd} strokeWidth="1"/><Ellipse cx="17" cy="27" rx="3.5" ry="3.5" fill={ol}/><Ellipse cx="47" cy="27" rx="6" ry="6" fill={outfit} stroke={hd} strokeWidth="1"/><Ellipse cx="47" cy="27" rx="3.5" ry="3.5" fill={ol}/></G>;
      return cap;
    };
    const Acc=()=>{
      if(accessory==='bow')return<G><Path d="M18,7 C17,0 26,-1 28,7 C26,15 17,16 18,7 Z" fill={outfit} stroke={hd} strokeWidth="1"/><Path d="M46,7 C47,0 38,-1 36,7 C38,15 47,16 46,7 Z" fill={outfit} stroke={hd} strokeWidth="1"/><Circle cx="32" cy="7" r="5.5" fill={ol} stroke={hd} strokeWidth="1"/><Circle cx="32" cy="7" r="3" fill={outfit}/><Circle cx="31" cy="6" r="1.5" fill="rgba(255,255,255,0.7)"/></G>;
      if(accessory==='tiara')return<G><Path d="M14,20 Q32,15 50,20 L50,26 Q32,22 14,26 Z" fill="#d4a820" stroke="#a07010" strokeWidth="0.8"/><Path d="M23,20 L19,9 L28,20 Z" fill="#e8c030" stroke="#a07010" strokeWidth="0.7"/><Path d="M29,20 L26,4 L32,0 L38,4 L35,20 Z" fill="#f0cc28" stroke="#a07010" strokeWidth="0.7"/><Path d="M41,20 L45,9 L36,20 Z" fill="#e8c030" stroke="#a07010" strokeWidth="0.7"/><Circle cx="32" cy="6" r="4.5" fill="#ff88cc" stroke="#a07010" strokeWidth="0.7"/><Circle cx="32" cy="6" r="2.5" fill="#ffbbdd"/><Circle cx="31" cy="5" r="1.2" fill="white" opacity="0.8"/><Circle cx="21" cy="14" r="3" fill="#88aaff" stroke="#a07010" strokeWidth="0.6"/><Circle cx="43" cy="14" r="3" fill="#88aaff" stroke="#a07010" strokeWidth="0.6"/></G>;
      if(accessory==='band')return<Path d="M14,24 Q32,19 50,24 Q50,31 32,31 Q14,31 14,24 Z" fill={outfit} stroke={hd} strokeWidth="1" opacity="0.95"/>;
      if(accessory==='flower')return<G>{[0,60,120,180,240,300].map((deg,i)=>{const r=deg*Math.PI/180;return<Ellipse key={i} cx={45+Math.cos(r)*7} cy={10+Math.sin(r)*7} rx="4.5" ry="2.5" fill="#ff88bb" stroke={hd} strokeWidth="0.6" transform={`rotate(${deg+90} ${45+Math.cos(r)*7} ${10+Math.sin(r)*7})`}/>;})}<Circle cx="45" cy="10" r="5.5" fill="#ffee44" stroke={hd} strokeWidth="0.8"/><Circle cx="45" cy="10" r="2.8" fill="#cc8800"/><Circle cx="44" cy="9" r="1.3" fill="rgba(255,255,255,0.7)"/></G>;
      return null;
    };
    return(
      <Svg width={W} height={H} viewBox="0 0 64 144" style={{opacity,transform:flip?[{scaleX:-1}]:[]}}>
        <GirlHairBack/>
        <Path d="M22,111 Q20,124 20,133 Q20,137 24,138 Q28,139 30,137 Q31,129 30,119 Q30,113 30,111 Z" fill={sd} stroke={dk(sd,0.15)} strokeWidth="0.8"/>
        <Path d="M42,111 Q44,124 44,133 Q44,137 40,138 Q36,139 34,137 Q33,129 34,119 Q34,113 34,111 Z" fill={sd} stroke={dk(sd,0.15)} strokeWidth="0.8"/>
        <Path d="M17,133 Q16,138 17,141 Q21,143 30,142 Q33,140 30,137 Z" fill="#1a0822" stroke={dk('#1a0822',0.3)} strokeWidth="0.8"/>
        <Path d="M47,133 Q48,138 47,141 Q43,143 34,142 Q31,140 34,137 Z" fill="#1a0822" stroke={dk('#1a0822',0.3)} strokeWidth="0.8"/>
        <Path d="M20,52 Q16,60 15,74 Q14,88 13,111 L51,111 Q50,88 49,74 Q48,60 44,52 Q38,57 32,58 Q26,57 20,52 Z" fill={outfit} stroke={od} strokeWidth="0.9"/>
        <Path d="M20,52 Q16,62 15,78 L16,78 Q16,62 20,52 Z" fill={ol} opacity="0.28"/>
        <Path d="M44,52 Q48,62 49,78 L48,78 Q48,62 44,52 Z" fill={od} opacity="0.22"/>
        <Path d="M26,52 Q32,54 38,52 Q38,58 32,60 Q26,58 26,52 Z" fill={ol} opacity="0.55"/>
        <Path d="M20,52 Q11,58 9,74 Q8,83 13,88 Q16,91 18,88 Q15,83 16,76 Q17,66 21,62 Z" fill={sd} stroke={dk(sd,0.2)} strokeWidth="0.8"/>
        <Path d="M44,52 Q53,58 55,74 Q56,83 51,88 Q48,91 46,88 Q49,83 48,76 Q47,66 43,62 Z" fill={sd} stroke={dk(sd,0.2)} strokeWidth="0.8"/>
        <Ellipse cx="13" cy="88" rx="5" ry="6" fill={sd} stroke={dk(sd,0.18)} strokeWidth="0.8"/>
        <Ellipse cx="51" cy="88" rx="5" ry="6" fill={sd} stroke={dk(sd,0.18)} strokeWidth="0.8"/>
        <Path d="M18,30 Q14,20 16,12 Q20,2 32,1 Q44,2 48,12 Q50,20 46,30 Q44,38 40,42 Q36,46 32,47 Q28,46 24,42 Q20,38 18,30 Z" fill={skin} stroke={sd} strokeWidth="0.9"/>
        <Circle cx="22" cy="26" r="3.5" fill={lt(skin,0.12)} opacity="0.55"/>
        <Circle cx="42" cy="26" r="3.5" fill={lt(skin,0.12)} opacity="0.55"/>
        <Ellipse cx="24" cy="22" rx="5" ry="6" fill="white" stroke={sd} strokeWidth="0.7"/>
        <Ellipse cx="40" cy="22" rx="5" ry="6" fill="white" stroke={sd} strokeWidth="0.7"/>
        <Circle cx="25" cy="23" r="3.5" fill={eyeColor}/>
        <Circle cx="41" cy="23" r="3.5" fill={eyeColor}/>
        <Circle cx="26" cy="21" r="1.5" fill="rgba(255,255,255,0.8)"/>
        <Circle cx="42" cy="21" r="1.5" fill="rgba(255,255,255,0.8)"/>
        <Path d="M26,33 Q32,37 38,33" stroke={dk(skin,0.3)} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
        <GirlHairFront/>
        <Acc/>
      </Svg>
    );
  }

  // BOY
  const BoyHair=()=>{
    if(hairStyle==='Short')return<Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,17 32,15 Q20,17 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/>;
    if(hairStyle==='Spiky')return<G><Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,17 32,15 Q20,17 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M22,15 L18,3 L26,12 Z" fill={hairColor} stroke={hd} strokeWidth="0.7"/><Path d="M32,12 L30,0 L34,0 L32,12 Z" fill={hairColor} stroke={hd} strokeWidth="0.7"/><Path d="M42,15 L46,3 L38,12 Z" fill={hairColor} stroke={hd} strokeWidth="0.7"/></G>;
    if(hairStyle==='Buzz')return<Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,18 32,16 Q20,18 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8" opacity="0.85"/>;
    if(hairStyle==='Side')return<G><Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,17 32,15 Q20,17 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/><Path d="M18,20 Q24,8 38,10 Q44,11 46,18" stroke={hl} strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round"/></G>;
    if(hairStyle==='Curly')return<G><Path d="M18,27 Q17,9 32,6 Q47,9 46,27 Q44,17 32,15 Q20,17 18,27 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/>{[20,26,32,38,44].map((x,i)=><Circle key={i} cx={x} cy="14" r="5" fill={hairColor} stroke={hd} strokeWidth="0.7"/>)}</G>;
    if(hairStyle==='Mohawk')return<G><Path d="M18,27 Q17,14 32,12 Q47,14 46,27 Q44,20 32,18 Q20,20 18,27 Z" fill={hd} stroke={dk(hd,0.2)} strokeWidth="0.8"/><Path d="M26,14 Q32,0 38,14 Q35,10 32,10 Q29,10 26,14 Z" fill={hairColor} stroke={hd} strokeWidth="0.8"/></G>;
    return null;
  };
  return(
    <Svg width={W} height={H} viewBox="0 0 64 130" style={{opacity,transform:flip?[{scaleX:-1}]:[]}}>
      <Path d="M24,100 Q22,114 22,123 Q22,127 26,128 Q30,129 31,127 Q32,119 31,109 Q31,103 31,100 Z" fill={sd} stroke={dk(sd,0.15)} strokeWidth="0.8"/>
      <Path d="M40,100 Q42,114 42,123 Q42,127 38,128 Q34,129 33,127 Q32,119 33,109 Q33,103 33,100 Z" fill={sd} stroke={dk(sd,0.15)} strokeWidth="0.8"/>
      <Path d="M19,123 Q18,127 19,130 Q23,132 31,131 Q34,129 31,127 Z" fill="#1a1008" stroke={dk('#1a1008',0.3)} strokeWidth="0.8"/>
      <Path d="M45,123 Q46,127 45,130 Q41,132 33,131 Q30,129 33,127 Z" fill="#1a1008" stroke={dk('#1a1008',0.3)} strokeWidth="0.8"/>
      <Path d="M20,48 Q16,56 16,72 Q15,86 14,100 L50,100 Q49,86 48,72 Q48,56 44,48 Q38,52 32,53 Q26,52 20,48 Z" fill={outfit} stroke={od} strokeWidth="0.9"/>
      <Path d="M20,48 Q16,58 16,74 L17,74 Q17,58 20,48 Z" fill={ol} opacity="0.28"/>
      <Path d="M44,48 Q48,58 48,74 L47,74 Q47,58 44,48 Z" fill={od} opacity="0.22"/>
      <Path d="M20,48 Q11,54 9,68 Q8,78 13,82 Q16,85 18,82 Q15,77 16,70 Q17,62 21,58 Z" fill={sd} stroke={dk(sd,0.2)} strokeWidth="0.8"/>
      <Path d="M44,48 Q53,54 55,68 Q56,78 51,82 Q48,85 46,82 Q49,77 48,70 Q47,62 43,58 Z" fill={sd} stroke={dk(sd,0.2)} strokeWidth="0.8"/>
      <Ellipse cx="13" cy="82" rx="5" ry="5.5" fill={sd} stroke={dk(sd,0.18)} strokeWidth="0.8"/>
      <Ellipse cx="51" cy="82" rx="5" ry="5.5" fill={sd} stroke={dk(sd,0.18)} strokeWidth="0.8"/>
      <Path d="M18,28 Q14,18 16,10 Q20,1 32,0 Q44,1 48,10 Q50,18 46,28 Q44,36 40,40 Q36,44 32,45 Q28,44 24,40 Q20,36 18,28 Z" fill={skin} stroke={sd} strokeWidth="0.9"/>
      <Circle cx="22" cy="24" r="3" fill={lt(skin,0.12)} opacity="0.55"/>
      <Circle cx="42" cy="24" r="3" fill={lt(skin,0.12)} opacity="0.55"/>
      <Ellipse cx="23" cy="20" rx="5" ry="5.5" fill="white" stroke={sd} strokeWidth="0.7"/>
      <Ellipse cx="41" cy="20" rx="5" ry="5.5" fill="white" stroke={sd} strokeWidth="0.7"/>
      <Circle cx="24" cy="21" r="3.5" fill={eyeColor}/>
      <Circle cx="42" cy="21" r="3.5" fill={eyeColor}/>
      <Circle cx="25" cy="19" r="1.5" fill="rgba(255,255,255,0.8)"/>
      <Circle cx="43" cy="19" r="1.5" fill="rgba(255,255,255,0.8)"/>
      <Path d="M26,32 Q32,36 38,32" stroke={dk(skin,0.3)} strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      <BoyHair/>
    </Svg>
  );
}

function ElevatorRideOverlay({visible, fromFloor=0, toFloor=1, charData=null}){
  const {width:W, height:H} = useWindowDimensions();
  // landscape: long side = width
  const LW = Math.max(W,H);
  const LH = Math.min(W,H);

  const doorL   = useRef(new Animated.Value(-LW/2-4)).current;
  const doorR   = useRef(new Animated.Value( LW/2+4)).current;
  const shakeY  = useRef(new Animated.Value(0)).current;
  const lightP  = useRef(new Animated.Value(0.7)).current;
  const scanAnim= useRef(new Animated.Value(0)).current;
  const [curFloor, setCurFloor] = useState(fromFloor+1);
  const [phase,   setPhase]    = useState('open');   // open→closing→moving→opening→open

  const FLOOR_COLORS = ['#22cc44','#4488ff','#cc4466','#ffcc00'];
  const FLOOR_NAMES  = ['B','1','2','3','4'];

  useEffect(()=>{
    if(!visible){
      doorL.setValue(-LW/2-4);
      doorR.setValue( LW/2+4);
      shakeY.setValue(0);
      lightP.setValue(0.7);
      scanAnim.setValue(0);
      setCurFloor(fromFloor+1);
      setPhase('open');
      return;
    }
    // reset to open state first
    doorL.setValue(-LW/2-4);
    doorR.setValue( LW/2+4);
    setCurFloor(fromFloor+1);
    setPhase('open');

    // ── SEQUENCE ─────────────────────────────────────────────────────────────
    const t = setTimeout(()=>{
      // 1. Doors close
      setPhase('closing');
      Animated.parallel([
        Animated.timing(doorL,{toValue:0,duration:1000,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
        Animated.timing(doorR,{toValue:0,duration:1000,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
      ]).start(()=>{
        // 2. Lights flicker, vibrate, start moving
        Vibration.vibrate([0,60,30,60,30,80]);
        setPhase('moving');

        // Light flicker
        Animated.sequence([
          Animated.timing(lightP,{toValue:0.1,duration:80,useNativeDriver:false}),
          Animated.timing(lightP,{toValue:0.9,duration:60,useNativeDriver:false}),
          Animated.timing(lightP,{toValue:0.3,duration:50,useNativeDriver:false}),
          Animated.timing(lightP,{toValue:1.0,duration:80,useNativeDriver:false}),
        ]).start();

        // Initial lurch shake
        Animated.sequence([
          Animated.timing(shakeY,{toValue:-10,duration:90,useNativeDriver:true}),
          Animated.timing(shakeY,{toValue:8, duration:90,useNativeDriver:true}),
          Animated.timing(shakeY,{toValue:-5,duration:80,useNativeDriver:true}),
          Animated.timing(shakeY,{toValue:2, duration:80,useNativeDriver:true}),
          Animated.timing(shakeY,{toValue:0, duration:100,useNativeDriver:true}),
        ]).start();

        // Scan line loops while moving
        const loopScan=()=>Animated.sequence([
          Animated.timing(scanAnim,{toValue:1,duration:1200,useNativeDriver:true}),
          Animated.timing(scanAnim,{toValue:0,duration:0,  useNativeDriver:true}),
        ]).start(({finished})=>{ if(finished) loopScan(); });
        loopScan();

        // Floor number ticks up 700ms in
        setTimeout(()=>setCurFloor(toFloor+1), 900);

        // Arrival shake
        setTimeout(()=>{
          Vibration.vibrate([0,40,20,40]);
          Animated.sequence([
            Animated.timing(shakeY,{toValue:-6,duration:70,useNativeDriver:true}),
            Animated.timing(shakeY,{toValue:5, duration:70,useNativeDriver:true}),
            Animated.timing(shakeY,{toValue:-2,duration:60,useNativeDriver:true}),
            Animated.timing(shakeY,{toValue:0, duration:60,useNativeDriver:true}),
          ]).start();
        }, 2000);

        // 3. Doors open
        setTimeout(()=>{
          setPhase('opening');
          scanAnim.stopAnimation();
          Animated.parallel([
            Animated.timing(doorL,{toValue:-LW/2-4,duration:1100,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
            Animated.timing(doorR,{toValue: LW/2+4,duration:1100,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),
          ]).start(()=>{ setPhase('open'); });
        }, 2600);
      });
    }, 300);
    return()=>clearTimeout(t);
  },[visible]);

  if(!visible) return null;

  const isWin   = toFloor >= 4;
  const acColor = isWin ? '#80ffb0' : '#c9a44c';
  const scanY   = scanAnim.interpolate({inputRange:[0,1],outputRange:[-10,LH]});
  const ceilingH= LH*0.10;
  const floorH  = LH*0.12;
  const wallW   = LW*0.18;

  const phaseLabel =
    phase==='open'    ? '● DOORS OPEN'  :
    phase==='closing' ? '◉ CLOSING...'  :
    phase==='moving'  ? '▲ FLOOR '+curFloor :
                        '◉ OPENING...';

  return(
    <Animated.View style={{
      position:'absolute',left:0,right:0,top:0,bottom:0,
      backgroundColor:'#080614',
      transform:[{translateY:shakeY}],
    }}>
      <StatusBar hidden/>

      {/* ── CEILING ─────────────────────────────────────────────────────── */}
      <View style={{
        position:'absolute',left:0,right:0,top:0,height:ceilingH,
        backgroundColor:'#0e0c1e',
        borderBottomWidth:2,borderBottomColor:'#2a2848',
      }}>
        {/* Ceiling lights */}
        {[0.25,0.50,0.75].map((p,i)=>(
          <Animated.View key={i} style={{
            position:'absolute',top:ceilingH*0.18,
            left:`${p*100}%`,marginLeft:-28,
            width:56,height:14,borderRadius:4,
            backgroundColor:'#c9a44c',
            opacity:lightP,
            shadowColor:'#c9a44c',shadowRadius:16,shadowOpacity:0.9,elevation:6,
          }}/>
        ))}
        {/* Ceiling trim line */}
        <View style={{position:'absolute',bottom:0,left:wallW,right:wallW,height:1,backgroundColor:'rgba(201,164,76,0.15)'}}/>
      </View>

      {/* ── FLOOR ───────────────────────────────────────────────────────── */}
      <View style={{
        position:'absolute',left:0,right:0,bottom:0,height:floorH,
        backgroundColor:'#0c0a1a',
        borderTopWidth:2,borderTopColor:'#2a2848',
        overflow:'hidden',
      }}>
        {/* Checkered tiles */}
        {Array.from({length:4}).map((_,r)=>
          Array.from({length:10}).map((_,c)=>(
            <View key={`${r}${c}`} style={{
              position:'absolute',
              left:c*(LW/10), top:r*(floorH/4),
              width:LW/10, height:floorH/4,
              backgroundColor:(r+c)%2===0?'#16142c':'#0e0c1e',
            }}/>
          ))
        )}
        {/* Floor gloss line */}
        <View style={{position:'absolute',top:0,left:wallW,right:wallW,height:1,backgroundColor:'rgba(201,164,76,0.12)'}}/>
      </View>

      {/* ── LEFT WALL ───────────────────────────────────────────────────── */}
      <View style={{
        position:'absolute',left:0,top:ceilingH,bottom:floorH,width:wallW,
        backgroundColor:'#100e22',
        borderRightWidth:2,borderRightColor:'#2a2848',
      }}>
        {/* Wall panel lines */}
        <View style={{position:'absolute',top:'15%',bottom:'15%',right:14,width:2,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:1}}/>
        <View style={{position:'absolute',top:'30%',bottom:'30%',right:22,width:1,backgroundColor:'rgba(255,255,255,0.03)',borderRadius:1}}/>
      </View>

      {/* ── RIGHT WALL ──────────────────────────────────────────────────── */}
      <View style={{
        position:'absolute',right:0,top:ceilingH,bottom:floorH,width:wallW,
        backgroundColor:'#100e22',
        borderLeftWidth:2,borderLeftColor:'#2a2848',
      }}>
        {/* ── FLOOR BUTTON PANEL ──────────────────────────────────────── */}
        <View style={{
          position:'absolute',
          top:'10%',right:wallW*0.15,
          width:wallW*0.68,
          backgroundColor:'#080614',
          borderWidth:1,borderColor:'#2a2848',borderRadius:6,
          padding:8,alignItems:'center',gap:5,
        }}>
          <Text style={{color:'#444',fontFamily:'monospace',fontSize:6,letterSpacing:2,marginBottom:2}}>▲ FLOOR</Text>
          {[3,2,1,0].map(fi=>{
            const active = fi===(curFloor-1);
            return(
              <View key={fi} style={{
                width:32,height:32,borderRadius:16,
                borderWidth:1.5,
                borderColor:active?FLOOR_COLORS[fi]:'#1e1a30',
                backgroundColor:active?FLOOR_COLORS[fi]+'22':'#080614',
                alignItems:'center',justifyContent:'center',
              }}>
                <Text style={{
                  fontFamily:'monospace',fontSize:13,fontWeight:'900',
                  color:active?FLOOR_COLORS[fi]:'#2a2848',
                }}>{fi+1}</Text>
                {active&&<View style={{
                  position:'absolute',width:36,height:36,borderRadius:18,
                  borderWidth:1,borderColor:FLOOR_COLORS[fi]+'88',
                }}/>}
              </View>
            );
          })}
          {/* Emergency button */}
          <View style={{
            width:26,height:26,borderRadius:13,
            backgroundColor:'#3a0000',borderWidth:1,borderColor:'#880000',
            alignItems:'center',justifyContent:'center',marginTop:4,
          }}>
            <Text style={{color:'#880000',fontSize:9,fontFamily:'monospace',fontWeight:'900'}}>SOS</Text>
          </View>
        </View>
        {/* Wall panel lines */}
        <View style={{position:'absolute',top:'15%',bottom:'15%',left:14,width:2,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:1}}/>
      </View>

      {/* ── BACK WALL / MIRROR ──────────────────────────────────────────── */}
      <View style={{
        position:'absolute',
        left:wallW+2, right:wallW+2,
        top:ceilingH+2, bottom:floorH+2,
        backgroundColor:'#0e0c20',
        borderWidth:1, borderColor:'#1e1c38',
        overflow:'hidden',
      }}>
        {/* Mirror tint overlay */}
        <View style={{...StyleSheet.absoluteFillObject,backgroundColor:'#3040a0',opacity:0.05}}/>
        {/* Mirror reflection — character flipped, dimmed */}
        {charData&&(
          <View style={{
            position:'absolute',bottom:8,
            left:0,right:0,alignItems:'center',
            opacity:0.35,
            transform:[{scaleX:-1}],
          }}>
            <ChibiCharacter charData={charData} size={2.4}/>
          </View>
        )}
        {/* Mirror frame top edge */}
        <View style={{position:'absolute',top:0,left:0,right:0,height:2,backgroundColor:'rgba(255,255,255,0.06)'}}/>
        {/* Scan line on mirror */}
        <Animated.View style={{
          position:'absolute',left:0,right:0,height:3,
          backgroundColor:'rgba(180,160,255,0.12)',
          transform:[{translateY:scanY}],
        }}/>
      </View>

      {/* ── FLOOR NUMBER DISPLAY (top center) ───────────────────────────── */}
      <View style={{
        position:'absolute',
        top:ceilingH+8, left:'38%', right:'38%',
        height:LH*0.13,
        backgroundColor:'#060412',
        borderWidth:1.5, borderColor:'#2a2848',
        borderRadius:6,
        flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6,
      }}>
        <Text style={{color:acColor,fontSize:18,fontFamily:'monospace'}}>{fromFloor<toFloor?'▲':'▼'}</Text>
        <Text style={{color:acColor,fontSize:38,fontFamily:'monospace',fontWeight:'900',lineHeight:44}}>
          {curFloor}
        </Text>
        <Text style={{color:'#444',fontSize:13,fontFamily:'monospace',marginTop:6}}>FL</Text>
      </View>

      {/* ── PHASE LABEL (bottom center above floor) ─────────────────────── */}
      <View style={{
        position:'absolute',
        bottom:floorH+10,
        left:0,right:0,alignItems:'center',
      }}>
        <Text style={{
          color: phase==='moving'?acColor:'rgba(200,190,255,0.6)',
          fontFamily:'monospace',fontSize:10,fontWeight:'900',letterSpacing:4,
        }}>
          {phaseLabel}
        </Text>
      </View>

      {/* ── DOORS ───────────────────────────────────────────────────────── */}
      {/* Left door */}
      <Animated.View style={{
        position:'absolute',left:0,top:0,bottom:0,
        width:LW/2+4,
        backgroundColor:'#1c1a36',
        borderRightWidth:2,borderRightColor:'#2a2848',
        transform:[{translateX:doorL}],
      }}>
        {/* Door inner frame */}
        <View style={{flex:1,margin:12,borderWidth:1,borderColor:'#22203a',borderRadius:2}}>
          {/* Vertical grip strip */}
          <View style={{position:'absolute',top:20,bottom:20,right:10,width:5,backgroundColor:'#22203a',borderRadius:2}}/>
          {/* Door handle */}
          <View style={{position:'absolute',top:'50%',right:18,width:10,height:36,backgroundColor:'#2e2c50',borderRadius:4,marginTop:-18}}/>
          {/* Panel lines */}
          <View style={{position:'absolute',top:'25%',bottom:'25%',right:28,width:1,backgroundColor:'rgba(255,255,255,0.04)'}}/>
        </View>
        {/* Edge light strip */}
        <View style={{position:'absolute',top:0,bottom:0,right:0,width:2,backgroundColor:'rgba(201,164,76,0.3)'}}/>
      </Animated.View>

      {/* Right door */}
      <Animated.View style={{
        position:'absolute',right:0,top:0,bottom:0,
        width:LW/2+4,
        backgroundColor:'#1c1a36',
        borderLeftWidth:2,borderLeftColor:'#2a2848',
        transform:[{translateX:doorR}],
      }}>
        <View style={{flex:1,margin:12,borderWidth:1,borderColor:'#22203a',borderRadius:2}}>
          <View style={{position:'absolute',top:20,bottom:20,left:10,width:5,backgroundColor:'#22203a',borderRadius:2}}/>
          <View style={{position:'absolute',top:'50%',left:18,width:10,height:36,backgroundColor:'#2e2c50',borderRadius:4,marginTop:-18}}/>
          <View style={{position:'absolute',top:'25%',bottom:'25%',left:28,width:1,backgroundColor:'rgba(255,255,255,0.04)'}}/>
        </View>
        <View style={{position:'absolute',top:0,bottom:0,left:0,width:2,backgroundColor:'rgba(201,164,76,0.3)'}}/>
      </Animated.View>

    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHARACTER CREATOR
// ─────────────────────────────────────────────────────────────────────────────
function CharacterCreator({ onDone, uiMsg = { text:'', until:0 }, theme = THEMES[0] }){
  const fade=useRef(new Animated.Value(0)).current;
  const {width:W, height:H} = useWindowDimensions();
  const LW = Math.max(W,H);
  const LH = Math.min(W,H);

  useEffect(()=>{
    Animated.timing(fade,{toValue:1,duration:600,useNativeDriver:true}).start();
  },[fade]);

  const ROWS = Array.from({length: Math.ceil(CHARACTER_REGISTRY.length / 3)}, (_, i) => CHARACTER_REGISTRY.slice(i*3, i*3+3));
  const GAP = Math.round(LW * 0.012);
  const HEADER_H = Math.round(LH * 0.18);
  const cardW = Math.floor((LW - GAP*4) / 3);
  const imgSize = Math.round(cardW * 0.52);
  const cardPadH = Math.round(LH * 0.02);

  return(
    <Animated.View style={{width:LW,height:LH,backgroundColor:'#03020c',opacity:fade}}>
      <StatusBar hidden/>
      <View style={{height:HEADER_H,justifyContent:'center',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#1a1428',paddingHorizontal:16}}>
        <Text style={{fontSize:Math.round(Math.max(7,LH*0.016)),color:'#444',fontFamily:'monospace',letterSpacing:6,marginBottom:4}}>THE LAST FLOOR</Text>
        <Text style={{fontSize:Math.round(Math.max(14,Math.min(22,LH*0.048))),fontWeight:'900',color:'#e8dcc8',fontFamily:'monospace',letterSpacing:4,textAlign:'center'}}>
          CHOOSE YOUR SURVIVOR
        </Text>
        <Text style={{fontSize:Math.round(Math.max(8,LH*0.020)),color:'rgba(255,255,255,0.28)',fontFamily:'monospace',letterSpacing:2,marginTop:4,textAlign:'center'}}>
          COSMETIC ONLY — all survivors play identically
        </Text>
      </View>
      <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:'center',alignItems:'center',paddingVertical:GAP,gap:GAP}} showsVerticalScrollIndicator={false}>
        {ROWS.map((row,ri)=>(
          <View key={ri} style={{flexDirection:'row',justifyContent:'center',gap:GAP}}>
            {row.map((entry)=>(
              <TouchableOpacity
                key={entry.id}
                activeOpacity={0.82}
                onPress={()=>{
                  const cd={
                    ...entry.fallback,
                    spriteImage:entry.spriteImage,
                    spriteWidth:entry.spriteWidth,
                    spriteHeight:entry.spriteHeight,
                    _registryId:entry.id,
                  };
                  onDone(cd);
                }}
                style={{
                  width:cardW,
                  alignItems:'center',
                  paddingTop:cardPadH,paddingBottom:cardPadH,paddingHorizontal:Math.round(cardW*0.06),
                  borderWidth:2,borderColor:entry.borderColor,
                  borderRadius:18,backgroundColor:entry.bgColor,
                  gap:Math.round(LH*0.012),
                }}
              >
                <Image
                  source={entry.spriteImage}
                  style={{width:imgSize,height:imgSize}}
                  resizeMode="contain"
                />
                <Text style={{fontSize:Math.round(Math.max(10,Math.min(14,LH*0.030))),fontWeight:'900',color:entry.accentColor,fontFamily:'monospace',letterSpacing:2,textAlign:'center'}}>{entry.name}</Text>
                <Text style={{fontSize:Math.round(Math.max(7,LH*0.018)),color:'#667',fontFamily:'monospace',letterSpacing:1}}>{entry.sub}</Text>
                <View style={{
                  backgroundColor:entry.accentColor+'28',
                  borderWidth:1.5,borderColor:entry.accentColor+'99',
                  paddingVertical:Math.round(LH*0.014),borderRadius:10,width:'100%',alignItems:'center',
                }}>
                  <Text style={{color:entry.accentColor,fontFamily:'monospace',fontWeight:'900',fontSize:Math.round(Math.max(10,Math.min(13,LH*0.028))),letterSpacing:2}}>SELECT</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );

}

// ─────────────────────────────────────────────────────────────────────────────
//  TITLE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function TitleScreen({onStart}){
  const fade=useRef(new Animated.Value(0)).current;
  const gy=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.timing(fade,{toValue:1,duration:1200,useNativeDriver:true}).start();
    const loop=()=>Animated.sequence([Animated.timing(gy,{toValue:-14,duration:900,useNativeDriver:true}),Animated.timing(gy,{toValue:0,duration:800,useNativeDriver:true}),Animated.delay(300)]).start(loop);loop();
  },[]);
  return(
    <Animated.View style={{flex:1,backgroundColor:'#03020a',opacity:fade}}>
      <StatusBar hidden/>
      <View style={{flex:1,justifyContent:'center',alignItems:'center',gap:18,padding:32}}>
        <Animated.Text style={{fontSize:42,fontWeight:"900",color:"#c8c0e8",fontFamily:"monospace",letterSpacing:3,transform:[{translateY:gy}]}}>GHOST</Animated.Text>
        <Text style={{fontSize:24,fontWeight:'900',color:'#e8dcc8',fontFamily:'monospace',letterSpacing:5,textAlign:'center'}}>THE LAST{'\n'}FLOOR</Text>
        <Text style={{color:'#444',fontFamily:'monospace',fontSize:10,textAlign:'center',lineHeight:18,maxWidth:320}}>
          4 floors. Each ghost guards its territory.{'\n'}Enter their zone — they will notice you.
        </Text>
        <View style={{gap:8,marginTop:10,width:'80%',maxWidth:360}}>
          {[['THE MAZE','1 ghost patrol zone','→ Find the key, reach the elevator'],['THE UPPER FLOOR','2 overlapping zones','→ Time your crossing carefully'],['THE ATTIC','2 fast zones + maze','→ Predict and avoid. Speed helps.'],['NO ESCAPE','Ghosts everywhere','→ Run. Never stop.']].map(([n,d,tip],i)=>(
            <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:['#143314','#141434','#341422','#3a0008'][i],borderRadius:6,padding:9,borderWidth:1,borderColor:THEMES[i].edge+'44'}}>
              <Text style={{color:'#c9a44c',fontFamily:'monospace',fontSize:9,letterSpacing:2,minWidth:20}}>F{i+1}</Text>
              <View style={{flex:1}}><Text style={{color:'#bbb',fontFamily:'monospace',fontSize:9}}>{d}</Text><Text style={{color:'#666',fontFamily:'monospace',fontSize:8,marginTop:1}}>{tip}</Text></View>
              <Text style={{color:'#c8c0e8',fontFamily:'monospace',fontWeight:'900',fontSize:10,letterSpacing:1}}>{i+1}G</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={onStart} style={{marginTop:12,borderWidth:1,borderColor:'#c9a44c',paddingVertical:14,paddingHorizontal:44,borderRadius:4,backgroundColor:'#0a0818'}} activeOpacity={0.8}>
          <Text style={{color:'#c9a44c',fontFamily:'monospace',letterSpacing:7,fontSize:16,fontWeight:'900'}}>PLAY</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEAD / WIN SCREENS
// ─────────────────────────────────────────────────────────────────────────────
// M4.2: DeadScreen — landscape 2-column layout, coin-continue with doubling cost
function DeadScreen({charData,onMenu,floorNum=1,totalCoins=0,continueCost=15,onContinuePaid}){
  const fade   = useRef(new Animated.Value(0)).current;
  const sc     = useRef(new Animated.Value(0.88)).current;
  const glowA  = useRef(new Animated.Value(0)).current;
  const { width: W, height: H } = useWindowDimensions();
  const LW = Math.max(W, H); const LH = Math.min(W, H);

  useEffect(()=>{
    Vibration.vibrate([0,150,60,200,60,300]);
    Animated.parallel([
      Animated.timing(fade,{toValue:1,duration:600,useNativeDriver:true}),
      Animated.spring(sc,{toValue:1,friction:7,useNativeDriver:true}),
    ]).start();
    const loop=()=>Animated.sequence([
      Animated.timing(glowA,{toValue:1,duration:1200,useNativeDriver:true}),
      Animated.timing(glowA,{toValue:0.2,duration:1200,useNativeDriver:true}),
    ]).start(loop);
    loop();
  },[]);

  const tips=['Stay outside zone rings — ghosts notice intruders.','Use FREEZE to move freely for 20s.','PUSH charges can save you from a chase.','Arm SHIELD before entering danger zones.','Check the 15s preview — plan your route first.'];
  const tip=tips[(floorNum-1)%tips.length];
  const canAfford=totalCoins>=continueCost;

  // Build progression display: 15 → 30 → 60 → 120 starting from continueCost
  const progressionSteps = [15, 30, 60, 120];
  // which step are we currently on?
  const currentStepIndex = progressionSteps.indexOf(continueCost);

  const handleContinue=()=>{
    if(!canAfford){
      Alert.alert(
        'Not Enough Coins 🪙',
        `You need ${continueCost}🪙 to continue.\nYou have ${totalCoins}🪙.\n\n💡 Earn coins by:\n• Surviving floors (+1–4 per floor)\n• Collecting 🪙 coins in the maze\n• Killing ghosts with 💥 PUSH (+1 each)`,
        [{text:'OK',style:'cancel'}]
      );
      return;
    }
    // Pay directly — no intermediate Alert (Alerts can fail on web/Snack)
    if(onContinuePaid) onContinuePaid();
  };

  return(
    <Animated.View style={{width:LW,height:LH,backgroundColor:'#060004',flexDirection:'row',opacity:fade}}>
      <StatusBar hidden/>
      <View style={{position:'absolute',top:0,left:0,right:0,height:3,backgroundColor:'#aa0015'}}/>

      {/* LEFT — character + title + coins */}
      <View style={{width:LW*0.38,justifyContent:'center',alignItems:'center',gap:8,
        borderRightWidth:1,borderRightColor:'rgba(200,0,20,0.20)',paddingHorizontal:16}}>
        <Animated.View style={{transform:[{scale:sc}],opacity:0.35}}>
          {charData&&<ChibiCharacter charData={charData} size={2.5}/>}
        </Animated.View>
        <Animated.Text style={{fontSize:36,fontWeight:'900',color:'#cc1122',fontFamily:'monospace',letterSpacing:4,
          textShadowColor:glowA.interpolate({inputRange:[0,1],outputRange:['rgba(200,0,20,0)','rgba(200,0,20,0.6)']}),
          textShadowRadius:24}}>DEFEATED</Animated.Text>
        <Text style={{color:'rgba(255,255,255,0.30)',fontFamily:'monospace',fontSize:9,letterSpacing:3,textAlign:'center'}}>
          FLOOR {floorNum}  ·  CAUGHT
        </Text>

        {/* Coin balance */}
        <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:4,
          paddingHorizontal:14,paddingVertical:6,borderRadius:16,
          backgroundColor:'rgba(201,164,76,0.10)',borderWidth:1,borderColor:'rgba(201,164,76,0.25)'}}>
          <Text style={{fontSize:16}}>🪙</Text>
          <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:18}}>{totalCoins}</Text>
          <Text style={{color:'rgba(201,164,76,0.5)',fontFamily:'monospace',fontSize:9}}> COINS</Text>
        </View>

        {/* Earn coins tip */}
        <View style={{paddingHorizontal:10,paddingVertical:7,borderRadius:10,
          backgroundColor:'rgba(201,164,76,0.05)',borderWidth:1,borderColor:'rgba(201,164,76,0.15)',
          width:'100%',gap:3}}>
          <Text style={{color:'rgba(201,164,76,0.55)',fontFamily:'monospace',fontSize:7,letterSpacing:2,marginBottom:2}}>EARN COINS</Text>
          <Text style={{color:'rgba(255,255,255,0.40)',fontFamily:'monospace',fontSize:8,lineHeight:13}}>🏃 Survive a floor  +1–4</Text>
          <Text style={{color:'rgba(255,255,255,0.40)',fontFamily:'monospace',fontSize:8,lineHeight:13}}>🪙 Pick up maze coins  +1</Text>
          <Text style={{color:'rgba(255,230,100,0.60)',fontFamily:'monospace',fontSize:8,lineHeight:13}}>💥 PUSH kills ghost  +1</Text>
        </View>
      </View>

      {/* RIGHT — cost progression + buttons */}
      <View style={{flex:1,justifyContent:'center',paddingHorizontal:16,gap:9}}>

        {/* Coin cost progression card */}
        <View style={{borderRadius:12,padding:12,
          backgroundColor:'rgba(201,164,76,0.06)',borderWidth:1.5,borderColor:'rgba(201,164,76,0.28)',gap:6}}>
          <Text style={{color:'rgba(201,164,76,0.65)',fontFamily:'monospace',fontSize:8,letterSpacing:3,marginBottom:2}}>CONTINUE COST THIS RUN</Text>
          {/* Step row */}
          <View style={{flexDirection:'row',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            {progressionSteps.map((cost, idx)=>{
              const isCurrent = cost === continueCost;
              const isPast    = currentStepIndex >= 0 && idx < currentStepIndex;
              const isFuture  = currentStepIndex >= 0 && idx > currentStepIndex;
              return(
                <React.Fragment key={cost}>
                  <View style={{
                    paddingHorizontal:8,paddingVertical:4,borderRadius:8,
                    backgroundColor: isCurrent?'rgba(201,164,76,0.22)': isPast?'rgba(255,80,80,0.10)':'rgba(255,255,255,0.04)',
                    borderWidth:1.5,
                    borderColor: isCurrent?'#c9a44c': isPast?'rgba(255,80,80,0.35)':'rgba(255,255,255,0.10)',
                    alignItems:'center',
                  }}>
                    <Text style={{
                      color: isCurrent?'#f0c850': isPast?'rgba(255,100,100,0.55)':'rgba(255,255,255,0.25)',
                      fontFamily:'monospace',fontWeight:'900',fontSize:isCurrent?13:10,
                    }}>{cost}🪙</Text>
                    {isCurrent&&(
                      <Text style={{color:'#c9a44c',fontFamily:'monospace',fontSize:6,letterSpacing:1,marginTop:1}}>NOW</Text>
                    )}
                  </View>
                  {idx < progressionSteps.length-1 && (
                    <Text style={{color:'rgba(255,255,255,0.20)',fontFamily:'monospace',fontSize:10}}>→</Text>
                  )}
                </React.Fragment>
              );
            })}
          </View>
          <Text style={{color:'rgba(255,255,255,0.28)',fontFamily:'monospace',fontSize:8,letterSpacing:1,marginTop:2}}>
            ↺ Resets to 15🪙 on every new game
          </Text>
        </View>

        {/* Survival tip */}
        <View style={{borderRadius:10,padding:10,
          backgroundColor:'rgba(255,255,255,0.03)',borderWidth:1,borderColor:'rgba(255,255,255,0.07)'}}>
          <Text style={{color:'rgba(201,164,76,0.6)',fontFamily:'monospace',fontSize:7,letterSpacing:3,marginBottom:4}}>SURVIVAL TIP</Text>
          <Text style={{color:'rgba(255,255,255,0.50)',fontFamily:'monospace',fontSize:9,lineHeight:14}}>{tip}</Text>
        </View>

        {/* ── PAID CONTINUE — costs coins, same floor ── */}
        <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}
          style={{
            paddingVertical:15, borderRadius:12,
            backgroundColor: canAfford ? 'rgba(201,164,76,0.18)' : 'rgba(201,164,76,0.05)',
            borderWidth:2, borderColor: canAfford ? '#c9a44c' : 'rgba(201,164,76,0.30)',
            alignItems:'center', gap:2,
          }}>
          <Text style={{
            color: canAfford ? '#f0c850' : 'rgba(201,164,76,0.40)',
            fontFamily:'monospace', fontWeight:'900', fontSize:14, letterSpacing:2,
          }}>
            🪙  CONTINUE — COSTS {continueCost}🪙
          </Text>
          {canAfford ? (
            <Text style={{color:'rgba(201,164,76,0.55)',fontFamily:'monospace',fontSize:8,marginTop:1}}>
              You have {totalCoins}🪙 · leaves you {totalCoins - continueCost}🪙
            </Text>
          ) : (
            <Text style={{color:'rgba(255,120,80,0.75)',fontFamily:'monospace',fontSize:8,marginTop:1}}>
              ✕ Not enough — you need {continueCost - totalCoins} more coins
            </Text>
          )}
        </TouchableOpacity>

        {/* Home button */}
        <TouchableOpacity onPress={onMenu} activeOpacity={0.85}
          style={{
            paddingVertical:11, borderRadius:10,
            backgroundColor:'rgba(255,255,255,0.03)',
            borderWidth:1, borderColor:'rgba(255,255,255,0.10)',
            alignItems:'center',
          }}>
          <Text style={{color:'rgba(255,255,255,0.45)',fontFamily:'monospace',fontSize:11,letterSpacing:2}}>
            ⌂  BACK TO HOME
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function WinScreen({charData,onPlay,onMenu,durMs=0,bestEscapeMs=0,brokeRecord=false,escapes=0}){
  const fade=useRef(new Animated.Value(0)).current;
  const sc=useRef(new Animated.Value(0.7)).current;
  const glowAnim=useRef(new Animated.Value(0)).current;
  const { width: W, height: H } = useWindowDimensions();
  const LW = Math.max(W, H); const LH = Math.min(W, H);

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fade,{toValue:1,duration:800,useNativeDriver:true}),
      Animated.spring(sc,{toValue:1,friction:5,useNativeDriver:true}),
    ]).start();
    Vibration.vibrate([0,80,40,80,40,160,80,200]);
    const loop=()=>Animated.sequence([
      Animated.timing(glowAnim,{toValue:1,duration:1000,useNativeDriver:true}),
      Animated.timing(glowAnim,{toValue:0.3,duration:1000,useNativeDriver:true}),
    ]).start(loop);
    loop();
  },[]);

  const msToClock=(ms)=>{if(!ms||ms<=0)return'--';const t=Math.floor(ms/1000);const m=Math.floor(t/60);const s=t%60;return`${m}:${s<10?'0':''}${s}`;};

  return(
    <Animated.View style={{width:LW,height:LH,backgroundColor:'#020b06',flexDirection:'row',opacity:fade}}>
      <StatusBar hidden/>

      {/* LEFT — character + title */}
      <View style={{width:LW*0.40,justifyContent:'center',alignItems:'center',gap:8,
        borderRightWidth:1,borderRightColor:'rgba(94,207,160,0.15)',paddingHorizontal:16}}>
        <Animated.View style={{transform:[{scale:sc}]}}>
          {charData&&<ChibiCharacter charData={charData} size={2.6}/>}
        </Animated.View>
        <Animated.Text style={{fontSize:32,fontWeight:'900',color:'#5ecfa0',fontFamily:'monospace',letterSpacing:4,
          textShadowColor:glowAnim.interpolate({inputRange:[0,1],outputRange:['rgba(94,207,160,0)','rgba(94,207,160,0.6)']}),
          textShadowRadius:20}}>
          ESCAPED!
        </Animated.Text>
        <Text style={{color:'rgba(255,255,255,0.40)',fontFamily:'monospace',fontSize:10,letterSpacing:2,textAlign:'center'}}>
          All 4 floors conquered
        </Text>
        {brokeRecord&&(
          <View style={{paddingHorizontal:10,paddingVertical:5,borderRadius:8,
            backgroundColor:'rgba(201,164,76,0.15)',borderWidth:1,borderColor:'rgba(201,164,76,0.40)'}}>
            <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:10,letterSpacing:2}}>★ NEW RECORD</Text>
          </View>
        )}
      </View>

      {/* RIGHT — score + buttons */}
      <View style={{flex:1,justifyContent:'center',paddingHorizontal:20,gap:12}}>
        {/* Score card */}
        <View style={{borderRadius:12,borderWidth:1,borderColor:'rgba(94,207,160,0.20)',
          backgroundColor:'rgba(94,207,160,0.05)',padding:14,gap:8}}>
          <Text style={{color:'rgba(255,255,255,0.30)',fontFamily:'monospace',fontSize:9,letterSpacing:3}}>YOUR SCORE</Text>
          {[
            {label:'This run', value:msToClock(durMs), color:'#5ecfa0'},
            {label:'Best time', value:msToClock(bestEscapeMs), color:'#c9a44c'},
            {label:'Total escapes', value:escapes, color:'#d6c8ff'},
          ].map(r=>(
            <View key={r.label} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.55)',fontFamily:'monospace',fontSize:11}}>{r.label}</Text>
              <Text style={{color:r.color,fontFamily:'monospace',fontWeight:'900',fontSize:13}}>{r.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={onPlay} activeOpacity={0.85}
          style={{paddingVertical:14,borderRadius:10,
            backgroundColor:'rgba(94,207,160,0.14)',borderWidth:1.5,borderColor:'#5ecfa0',alignItems:'center'}}>
          <Text style={{color:'#5ecfa0',fontFamily:'monospace',fontWeight:'900',fontSize:13,letterSpacing:3}}>▶ PLAY AGAIN</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onMenu} activeOpacity={0.85}
          style={{paddingVertical:12,borderRadius:10,
            backgroundColor:'rgba(255,255,255,0.03)',borderWidth:1,borderColor:'rgba(255,255,255,0.14)',alignItems:'center'}}>
          <Text style={{color:'rgba(255,255,255,0.55)',fontFamily:'monospace',fontSize:12,letterSpacing:2}}>⌂ MAIN MENU</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function GameCore({ navigation }){
  const canUseAV=!!Audio;
  const{width,height}=useWindowDimensions();
  // Always use landscape dimensions: long side = width
  const SW = Math.max(width, height);
  const SH = Math.min(width, height);

  // ── screen state MUST be declared before the useEffect that uses it ──────────
  const[screen,setScreen]=useState('intro');

  useEffect(()=>{
    const run = async()=>{
      try{
        if(!ScreenOrientation) return;
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      }catch(e){/* ignore */}
    };
    run();
  },[]);

  const HUD_H      = Math.round(Math.max(34, Math.min(42, SH * 0.088)));
  const HINT_H     = Math.round(Math.max(16, Math.min(20, SH * 0.044)));
  // ACT_H: button height — responsive, slightly smaller to fit single row
  const ACT_H      = Math.round(Math.max(28, Math.min(38, SH * 0.092)));
  const SAFE_BOT   = Platform.OS === 'ios' ? 10 : 2;
  // Single row of controls — 1×ACT_H + padding (much more viewport space)
  const CONTROLS_H = ACT_H + SAFE_BOT + 14;
  // ZOOM: fit world to screen width, no over-zoom so maze stays inside viewport
  const ZOOM=useMemo(()=>{
    return Math.max(0.08, SW / WORLD_W);
  },[SW]);

  const runStartRef = useRef(0);
  const [stats, setStats] = useState({ totalPlayMs: 0, bestEscapeMs: 0, escapes: 0, deaths: 0 });
  const statsRef = useRef({ totalPlayMs: 0, bestEscapeMs: 0, escapes: 0, deaths: 0 });
  const floorsCompletedThisRunRef = useRef(0);  // tracks floors done this run for coin calc
  const coinsEarnedThisRunRef = useRef(0);      // coins accumulated this run
  const [totalCoins, setTotalCoins] = useState(0);
  const totalCoinsRef = useRef(0);
  // M4.2: Continue-after-death cost tracking (doubles each time, resets on new run)
  const continueCostRef = useRef(CONTINUE_COST_BASE);
  const continueCountRef = useRef(0);
  // Mirror continueCost as state so DeadScreen always re-renders with the correct (doubled) cost
  const [continueCost, setContinueCost] = useState(CONTINUE_COST_BASE);

  const loadStats = useCallback(async()=>{
    try{
      const raw = await storage.get(STATS_KEY);
      if(raw){
        const j = JSON.parse(raw);
        if(j && typeof j === 'object'){
          statsRef.current = {...statsRef.current, ...j};
          setStats(s => ({...s, ...j}));
        }
      }
    }catch(e){/* ignore */}
  },[]);

  const saveStats = useCallback(async(next)=>{
    try{ await storage.set(STATS_KEY, JSON.stringify(next)); }catch(e){/* ignore */}
  },[]);


  const[boot,setBoot]=useState(true);
  useEffect(()=>{
    loadStats();
    const t=setTimeout(()=>setBoot(false),2500);
    return()=>clearTimeout(t);
  },[]);
 
  const[pauseOpen,setPauseOpen]=useState(false);
  const pausedRef=useRef(false);
  const setPaused=(v)=>{pausedRef.current=v;};
  const[winData,setWinData]=useState({durMs:0,bestEscapeMs:0,brokeRecord:false});
const[charData,setCharData]=useState(null);
  const charDataRef=useRef(null);

  const[profile,setProfile]=useState({name:''});
  const profileRef=useRef({name:''});
  // Always update both state AND ref together — never let them diverge
  const updateProfile = useCallback((next) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  // Resolve a saved character: reattach require()'d spriteImage by _registryId
  const resolveCharData=(cd)=>{
    if(!cd)return null;
    if(cd._registryId){
      const entry=CHARACTER_REGISTRY.find(e=>e.id===cd._registryId);
      if(entry)return{...cd,spriteImage:entry.spriteImage,spriteWidth:entry.spriteWidth,spriteHeight:entry.spriteHeight};
    }
    const{spriteImage:_si,...rest}=cd;
    return rest;
  };

  useEffect(()=>{(async()=>{
    const raw=await storage.get(PROFILE_KEY);
    if(raw){try{
      const p=JSON.parse(raw);
      profileRef.current=p;setProfile(p);
      // Load audio settings saved from SettingsScreen
      if(typeof p?.settings?.micEnabled==='boolean') setMicEnabled(p.settings.micEnabled);
      if(typeof p?.settings?.soundEnabled==='boolean'){
        setSoundEnabled(p.settings.soundEnabled);
        soundEnabledRef.current=p.settings.soundEnabled;
      }
    }catch(e){}}
    const cr=await storage.get(CHAR_KEY);
    if(cr){try{const cd=resolveCharData(JSON.parse(cr));if(cd){charDataRef.current=cd;setCharData(cd);}}catch(e){}}
    const rc=await storage.get(COINS_KEY);
    if(rc){try{const c=parseInt(rc,10)||0;totalCoinsRef.current=c;setTotalCoins(c);}catch(e){}}
  })();},[]);

  // startFlow as stable useCallback — reads live refs so it never stales
  const startFlow = useCallback(()=>{
    const nameOk = !!(profileRef.current?.name && String(profileRef.current.name).trim());
    const hasChar = !!charDataRef.current;
    if(!nameOk){ setScreen('nameset'); return; }
    if(!hasChar){ setScreen('customize'); return; }
    setScreen('typing');
  },[]);

  const[micEnabled,setMicEnabled]=useState(MIC_ENABLED_DEFAULT);
  const[soundEnabled,setSoundEnabled]=useState(true);
  const soundEnabledRef=useRef(true);
  const[micDb,setMicDb]=useState(-160);
  const micDbRef=useRef(-160);

  const _initialBuild=buildFloors();
  const floorsRef=useRef(_initialBuild.floors);
  const visitOrderRef=useRef(_initialBuild.visitOrder);
  const[visitSeq,setVisitSeq]=useState(_initialBuild.visitOrder);
  const[floorIndex,setFloorIndex]=useState(_initialBuild.visitOrder[0]);
  const floorIndexRef=useRef(0);
  const[keysTaken,setKeysTaken]=useState([false,false,false,false]);
  const keysTakenRef=useRef([false,false,false,false]);

  const[hearts,setHearts]=useState(MAX_HEARTS);
  const heartsRef=useRef(MAX_HEARTS);
  const[player,setPlayer]=useState({x:120,y:790});
  const playerRef=useRef({x:120,y:790});
  const enemiesRef=useRef([]);
  const moveRef=useRef({up:false,down:false,left:false,right:false});
  const[playerFacingLeft,setPlayerFacingLeft]=useState(false);
  const playerFacingLeftRef=useRef(false);

  const[panic,setPanic]=useState({active:false,endsAt:0,startsAt:0});
  const panicRef=useRef({active:false,endsAt:0,startsAt:0});
  const secondKeyTimeRef=useRef(null);
  const lastHitRef=useRef(0);

  const captureRef=useRef(null);
  const[captureUI,setCaptureUI]=useState({visible:false,type:null,progress01:0});

  // ── INVENTORY (NEW) ───────────────────────────────────────────────────────
  const [inv,setInv]=useState({
    speedUnlocked:false,
    sprintUsed:false,       // resets when a new speed pickup is collected
    shieldCharges:0,
    shieldArmed:false,
    bandagesCollected:0,
    pushCharges:2,
    freezeCharges:0,
  });
  const invRef=useRef({
    speedUnlocked:false,
    sprintUsed:false,
    shieldCharges:0,
    shieldArmed:false,
    bandagesCollected:0,
    pushCharges:2,
    freezeCharges:0,
  });

  // ── SPRINT (NEW) ──────────────────────────────────────────────────────────
  const [sprint,setSprint]=useState({active:false,endsAt:0});
  const sprintRef=useRef({active:false,endsAt:0});
  const lastTapRef=useRef({up:0,down:0,left:0,right:0});

  // ── RANDOM DARK + MIC MODE (NEW) ─────────────────────────────────────────
  const [darkMic,setDarkMic]=useState({phase:'idle',countdown:0,endsAt:0});
  const darkMicRef=useRef({phase:'idle',countdown:0,endsAt:0});
  const darkMicTickRef=useRef(0);
  const darkMicCheckRef=useRef(Date.now());

  // ── UI MESSAGE (short toast) ─────────────────────────────────────────────
  const [uiMsg,setUiMsg]=useState({text:'',until:0});
  const uiMsgRef=useRef({text:'',until:0});
  const showMsg = useCallback((text, ms = 1600) => {
    const until = Date.now() + ms;
    uiMsgRef.current = { text, until };
    setUiMsg(uiMsgRef.current);
  }, []);

  const openPause=useCallback(()=>{
    if(screen!=='play')return;
    // freeze gameplay and stop movement immediately
    setPaused(true);
    moveRef.current={up:false,down:false,left:false,right:false};
    setPauseOpen(true);
  },[screen]);

  const closePause=useCallback(()=>{
    setPauseOpen(false);
    setPaused(false);
  },[]);
  // ── PREVIEW PHASE (zoom-out reveal at start of each floor) ────────────────
  const[preview,setPreview]=useState(false);       // true = showing full-maze overview
  const[previewSec,setPreviewSec]=useState(15);    // countdown (15s per user request)
  const previewZoomAnim=useRef(new Animated.Value(1)).current; // 1=normal, zoomed out during preview
  const previewRef=useRef(false);
  const[previewTrigger,setPreviewTrigger]=useState(0); // increment to fire preview phase

  const[frozenUntil,setFrozenUntil]=useState(0);        // timestamp when freeze expires (0=not frozen)
  const frozenUntilRef=useRef(0);
  const[freezeActive,setFreezeActive]=useState(false);  // true = player-triggered freeze (lights on, ghosts hidden)
  const freezeActiveRef=useRef(false);
  const[speedBoosted,setSpeedBoosted]=useState(false);   // player speed boost active
  const speedBoostUntilRef=useRef(0);
  const[floorMaxHearts,setFloorMaxHearts]=useState(5);   // per-floor starting hearts
  const floorMaxHeartsRef=useRef(5);

  const[elevatorBusy,setElevatorBusy]=useState(false);
  const doorsProgress=useRef(new Animated.Value(0)).current;
  const[doorsLabel,setDoorsLabel]=useState('ELEVATOR');
  const[doorsVisible,setDoorsVisible]=useState(false);

  const[elevatorRide,setElevatorRide]=useState({visible:false,sec:0,fromFloor:0,toFloor:1});
  const elevatorRideRef=useRef({visible:false,sec:0,fromFloor:0,toFloor:1});

  const[silenceAlarm,setSilenceAlarm]=useState(false);


  const ambienceRef=useRef(null);
  const panicSndRef=useRef(null);
  const stepsRef=useRef(null);
  const ghostVoiceRef=useRef(null);
  const stepsPlayingRef=useRef(false);      // tracks footstep playback state
  const ghostVoicePlayingRef=useRef(false); // tracks ghost voice playback state
  const lastAudioCheckRef=useRef(0);        // throttle: audio checks run max every 80ms, not every RAF frame
  const recRef=useRef(null);
  const micPollRef=useRef(null);

  // For rendering: track enemy states to trigger re-render
  const[enemyStates,setEnemyStates]=useState([]);

  const currentFloor=floorsRef.current[floorIndex];
  const theme=THEMES[currentFloor.theme];

  // Keep invRef and inv state in sync
  const setInvSafe=(patch)=>{
    invRef.current={...invRef.current,...patch};
    setInv(invRef.current);
  };

// ── SPRINT: double-tap to activate — ONE USE per speed pickup, 30s duration ──
const registerTap = useCallback((dir)=>{
  if(!invRef.current.speedUnlocked) return;
  // Prevent re-activation if sprint was already used this pickup cycle
  if(invRef.current.sprintUsed) return;

  const now = Date.now();
  const lastTap = lastTapRef.current[dir] || 0;
  lastTapRef.current[dir] = now;

  if(now - lastTap <= DOUBLE_TAP_WINDOW_MS){
    if(!sprintRef.current.active){
      const endsAt = now + SPRINT_DURATION_MS;
      sprintRef.current = { active:true, endsAt };
      setSprint({ active:true, endsAt });
      // Mark as used — won't reactivate until speed pickup is collected again
      invRef.current = { ...invRef.current, sprintUsed: true };
      setInv({...invRef.current});
      showMsg('⚡ Sprint activated (30s) — one use per pickup!');
      Vibration.vibrate(15);
    }
  }
}, [showMsg]);

// ── SHIELD TOGGLE ───────────────────────────────────────────────────────────
const toggleShield = useCallback(()=>{
  if(invRef.current.shieldCharges <= 0){
    Alert.alert('Shield','No charges available.');
    return;
  }
  setInvSafe({ shieldArmed: !invRef.current.shieldArmed });
}, []);

const pushGhost = useCallback(()=>{
  if(invRef.current.pushCharges <= 0){
    showMsg('No push charges left! Find 💥 pickups.');
    return;
  }
  const pl = playerRef.current;
  const enemies = enemiesRef.current;
  if(!enemies || enemies.length===0){
    showMsg('No ghosts around!');
    return;
  }
  // Only works if a ghost is close (within 320 units)
  const PUSH_RANGE = 320;
  let closest=null, closestD=Infinity;
  for(const e of enemies){
    const d=dist(pl.x,pl.y,e.x,e.y);
    if(d<closestD){closestD=d;closest=e;}
  }
  if(!closest || closestD > PUSH_RANGE){
    showMsg(`💥 No ghost close enough! Get within range first.`);
    return;
  }
  // Kill it
  enemiesRef.current = enemies.filter(e=>e!==closest);
  const next = invRef.current.pushCharges-1;
  invRef.current={...invRef.current,pushCharges:next};
  setInv({...invRef.current});
  Vibration.vibrate([0,80,40,160,40,80]);
  // +1 coin bonus for pushing a ghost
  const pushCoinTotal = totalCoinsRef.current + 1;
  totalCoinsRef.current = pushCoinTotal;
  setTotalCoins(pushCoinTotal);
  coinsEarnedThisRunRef.current += 1;
  try{ storage.set(COINS_KEY, String(pushCoinTotal)); }catch(e){}
  showMsg(`💥 Ghost eliminated! +1🪙 bonus! ${next} push${next!==1?'es':''} left`);
},[ showMsg]);

const activateFreeze = useCallback(()=>{
  if(invRef.current.freezeCharges <= 0){
    showMsg('No freeze charges! Find ❄ pickup in the maze.');
    return;
  }
  if(freezeActiveRef.current){
    showMsg('Freeze is already active!');
    return;
  }
  // Activate: 20 seconds, lights on (preview mode), ghosts hidden
  const FREEZE_DURATION = 20000;
  const until = Date.now() + FREEZE_DURATION;
  frozenUntilRef.current = until;
  setFrozenUntil(until);
  freezeActiveRef.current = true;
  setFreezeActive(true);
  // Hide all ghosts (move them far away temporarily — we handle this via render filter)
  // Just freeze them in place and hide via render
  for(const e of enemiesRef.current){ e.frozenUntil=until; e.state='patrol'; }
  const nextFC = invRef.current.freezeCharges - 1;
  invRef.current={...invRef.current, freezeCharges:nextFC};
  setInv({...invRef.current});
  Vibration.vibrate([0,100,50,200,50,100]);
  showMsg('❄ FREEZE! Lights on for 20 seconds. Ghosts hidden!', 3000);
},[ showMsg]);

  const viewH=useMemo(()=>{
    const usable=SH-HUD_H-CONTROLS_H-SAFE_BOT;
    return Math.max(200,usable);
  },[SH,HUD_H,HINT_H,CONTROLS_H,SAFE_BOT]);

  const camera=useMemo(()=>{
    const cx=player.x,cy=player.y;
    const sw=SW/ZOOM,sh=viewH/ZOOM;
    const left=clamp(cx-sw/2,0,Math.max(0,WORLD_W-sw));
    const top=clamp(cy-sh/2,0,Math.max(0,WORLD_H-sh));
    return{translateX:-left*ZOOM,translateY:-top*ZOOM};
  },[player,SW,viewH,ZOOM]);

  // Preview: scale to fit the ENTIRE world inside the viewport
  const previewScale=useMemo(()=>{
    const scaleX=SW/(WORLD_W*ZOOM);
    const scaleY=viewH/(WORLD_H*ZOOM);
    return Math.min(scaleX,scaleY)*0.92; // 92% so there's a little margin
  },[SW,viewH,ZOOM]);

  // ── AUDIO ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!canUseAV)return;
    let mounted=true;
    (async()=>{
      try{await Audio.setAudioModeAsync({allowsRecordingIOS:true,playsInSilentModeIOS:true,staysActiveInBackground:false,shouldDuckAndroid:true});}catch(e){/* ignore */}
      const amb=await safeLoadLoop(SOUND_URLS.ambience,0.45);
      const pnc=await safeLoadLoop(SOUND_URLS.panic,0.0);
      // Steps and ghost voice: looping sounds controlled by play/pause (not volume)
      const stp=await safeLoadLoop(SOUND_URLS.steps,0.85);
      const ghv=await safeLoadLoop(SOUND_URLS.ghostVoice,0.80);
      if(!mounted){await safeUnload(amb);await safeUnload(pnc);await safeUnload(stp);await safeUnload(ghv);return;}
      ambienceRef.current=amb;panicSndRef.current=pnc;stepsRef.current=stp;ghostVoiceRef.current=ghv;
      // Only start ambience and panic track (panic starts silent via vol=0)
      // Respect soundEnabled setting
      if(soundEnabledRef.current){ await safePlay(amb); } else { await safeVol(amb,0); await safePlay(amb); }
      await safePlay(pnc);
    })();
    return()=>{mounted=false;(async()=>{
      await safeUnload(ambienceRef.current);await safeUnload(panicSndRef.current);
      await safeUnload(stepsRef.current);await safeUnload(ghostVoiceRef.current);
    })();};
  },[canUseAV]);


  // ── SOUND MUTE / UNMUTE — react to soundEnabled toggle in real time ──────────
  useEffect(()=>{
    soundEnabledRef.current = soundEnabled;
    if(!canUseAV) return;
    // Mute or restore ambience volume
    (async()=>{
      try{
        if(ambienceRef.current){
          await safeVol(ambienceRef.current, soundEnabled ? 0.45 : 0);
        }
        // Steps: if sound is now off and they were playing, pause them
        if(!soundEnabled && stepsPlayingRef.current){
          stepsPlayingRef.current = false;
          if(stepsRef.current) await stepsRef.current.pauseAsync().catch(()=>{});
        }
        // Ghost voice: stop if muted
        if(!soundEnabled && ghostVoicePlayingRef.current){
          ghostVoicePlayingRef.current = false;
          if(ghostVoiceRef.current){
            await ghostVoiceRef.current.stopAsync().catch(()=>{});
            await ghostVoiceRef.current.setPositionAsync(0).catch(()=>{});
          }
        }
      }catch(e){}
    })();
  },[soundEnabled, canUseAV]);

  // ── MIC ──────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    // Mic is forced ON only during Dark + Mic ACTIVE phase
    const shouldRun=canUseAV&&screen==='play'&&darkMicRef.current.phase==='active';
    const stopMic=async()=>{
      if(micPollRef.current){clearInterval(micPollRef.current);micPollRef.current=null;}
      try{if(recRef.current){const r=recRef.current;recRef.current=null;await r.stopAndUnloadAsync();}}catch(e){/* ignore */}
      setMicDb(-160);
    };
    const startMic=async()=>{
      try{
        const perm=await Audio.requestPermissionsAsync();
        if(!perm.granted){setMicEnabled(false);Alert.alert('Microphone','Permission not granted. Mic lure turned OFF.');return;}
        const rec=new Audio.Recording();
        await rec.prepareToRecordAsync({android:{extension:'.m4a',outputFormat:Audio.AndroidOutputFormat.MPEG_4,audioEncoder:Audio.AndroidAudioEncoder.AAC,sampleRate:44100,numberOfChannels:1,bitRate:64000},ios:{extension:'.caf',audioQuality:Audio.IOSAudioQuality.MIN,sampleRate:44100,numberOfChannels:1,bitRate:64000,linearPCMBitDepth:16,linearPCMIsBigEndian:false,linearPCMIsFloat:false},isMeteringEnabled:true});
        await rec.startAsync();recRef.current=rec;
        micPollRef.current=setInterval(async()=>{try{if(!recRef.current)return;const s=await recRef.current.getStatusAsync();if(typeof s.metering==='number'){micDbRef.current=s.metering;setMicDb(s.metering);}}catch(e){/* ignore */}},MIC_POLL_MS);
      }catch{setMicEnabled(false);}
    };
    if(shouldRun)startMic();else stopMic();
    return()=>stopMic();
  },[screen,canUseAV,darkMic.phase]);

  // ── PANIC ────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const count=keysTaken.filter(Boolean).length;
    if(count===2&&secondKeyTimeRef.current===null)secondKeyTimeRef.current=Date.now();
  },[keysTaken]);

  useEffect(()=>{
    if(screen!=='play')return;
    const t=setInterval(()=>{
      const sk=secondKeyTimeRef.current;if(!sk)return;
      const now=Date.now(),p=panicRef.current;
      if(!p.active&&now-sk>=PANIC_DELAY_MS){
        const endsAt=now+PANIC_DURATION_MS;
        const next={active:true,startsAt:now,endsAt};
        panicRef.current=next;setPanic(next);
        safeVol(panicSndRef.current,0.85);
        const pl=playerRef.current;
        const extra=[];
        for(let i=0;i<PANIC_EXTRA_ENEMIES;i++){
          const ang=(Math.PI*2*i)/PANIC_EXTRA_ENEMIES;
          const rx=clamp(pl.x+Math.cos(ang)*230,ENEMY_R,WORLD_W-ENEMY_R);
          const ry=clamp(pl.y+Math.sin(ang)*230,ENEMY_R,WORLD_H-ENEMY_R);
          extra.push({x:rx,y:ry,patrol:[{x:rx,y:ry},{x:rx+10,y:ry+10}],patrolIndex:1,kind:'PANIC',
            zone:{cx:rx,cy:ry,r:120},state:'chase',alertUntil:0});
        }
        enemiesRef.current=[...enemiesRef.current,...extra];
      }
      if(p.active&&now>=p.endsAt){
        const next={active:false,startsAt:0,endsAt:0};
        panicRef.current=next;setPanic(next);
        safeVol(panicSndRef.current,0.0);
        enemiesRef.current=enemiesRef.current.filter(e=>e.kind!=='PANIC');
      }
    },250);
    return()=>clearInterval(t);
  },[screen]);

  // ── MAIN GAME LOOP ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if(screen!=='play')return;
    let raf=null,last=Date.now();
    let lastRenderPlayer=0,lastRenderCapture=0,lastRenderEnemies=0;
    const RENDER_PLAYER_MS=33,RENDER_CAPTURE_MS=60,RENDER_ENEMIES_MS=80;

    const cancelCapture=()=>{captureRef.current=null;setCaptureUI({visible:false,type:null,progress01:0});};

    const tick=()=>{
      const now=Date.now(),rawDt=now-last;last=now;
      const dt=Math.min(rawDt,40);
      if(elevatorBusy||previewRef.current||pausedRef.current){raf=requestAnimationFrame(tick);return;}

      // ── Dark + Mic mode random trigger / countdown / active ──────────────
      if(darkMicRef.current.phase==='idle' && (now-darkMicCheckRef.current)>=DARKMIC_CHECK_EVERY_MS){
        darkMicCheckRef.current=now;
        if(Math.random()<DARKMIC_TRIGGER_CHANCE){
          darkMicRef.current={phase:'countdown',countdown:DARKMIC_COUNTDOWN_SEC,endsAt:0};
          setDarkMic(darkMicRef.current);
          darkMicTickRef.current=now;
          showMsg('⚠ Dark mode in 5…');
        }
      }
      if(darkMicRef.current.phase==='countdown'){
        if(now-darkMicTickRef.current>=1000){
          darkMicTickRef.current=now;
          const next=darkMicRef.current.countdown-1;
          if(next<=0){
            const endsAt=now+DARKMIC_DURATION_MS;
            darkMicRef.current={phase:'active',countdown:0,endsAt};
            setDarkMic(darkMicRef.current);
            showMsg('Dark mode (30s). Be quiet.');
          }else{
            darkMicRef.current={...darkMicRef.current,countdown:next};
            setDarkMic(darkMicRef.current);
          }
        }
      }
      if(darkMicRef.current.phase==='active' && now>=darkMicRef.current.endsAt){
        darkMicRef.current={phase:'idle',countdown:0,endsAt:0};
        setDarkMic(darkMicRef.current);
      }

      // End sprint after duration
      if(sprintRef.current.active && now>=sprintRef.current.endsAt){
        sprintRef.current={active:false,endsAt:0};
        setSprint({active:false,endsAt:0});
      }
      const sprintActive = sprintRef.current.active && now<sprintRef.current.endsAt;

      const fi=floorIndexRef.current;
      const f=floorsRef.current[fi];
      const walls=f.walls;
      const mv=moveRef.current;
      const p0=playerRef.current;

      // ── PLAYER MOVEMENT ────────────────────────────────────────────────────
      let vx=0,vy=0;
      const _spd=PLAYER_SPD*(sprintActive?1.7:1);
      if(mv.left)vx-=_spd;
      if(mv.right)vx+=_spd;
      if(mv.up)vy-=_spd;
      if(mv.down)vy+=_spd;
      // Update facing direction when moving left or right
      if(mv.left&&!mv.right&&playerFacingLeftRef.current!==true){playerFacingLeftRef.current=true;setPlayerFacingLeft(true);}
      else if(mv.right&&!mv.left&&playerFacingLeftRef.current!==false){playerFacingLeftRef.current=false;setPlayerFacingLeft(false);}
      if(vx!==0&&vy!==0){vx*=0.7071;vy*=0.7071;}
      const k=dt/16.67;
      let nx=p0.x+vx*k,ny=p0.y+vy*k;
      nx=clamp(nx,PLAYER_R,WORLD_W-PLAYER_R);
      ny=clamp(ny,PLAYER_R,WORLD_H-PLAYER_R);
      for(const w of walls){
        if(circleRect(nx,ny,PLAYER_R,w.x,w.y,w.w,w.h)){
          const tx=p0.x+vx*k;
          if(!circleRect(tx,p0.y,PLAYER_R,w.x,w.y,w.w,w.h)){nx=tx;ny=p0.y;}
          else{const ty=p0.y+vy*k;if(!circleRect(p0.x,ty,PLAYER_R,w.x,w.y,w.w,w.h)){nx=p0.x;ny=ty;}else{nx=p0.x;ny=p0.y;}}
        }
      }
      playerRef.current={x:nx,y:ny};

      // ── COLLECT FREEZE GUN ── walk over = gain 1 freeze charge ──────────
      if(f.freezeGun&&!f.freezeGun.taken&&
         dist(nx,ny,f.freezeGun.x,f.freezeGun.y)<INTERACT_RADIUS+10){
        f.freezeGun.taken=true;
        const nextFC=invRef.current.freezeCharges+1;
        invRef.current={...invRef.current,freezeCharges:nextFC};
        setInv({...invRef.current});
        Vibration.vibrate([0,60,40,120]);
        showMsg('❄ Freeze collected! Press FREEZE to use (20s lights-on).');
      }

      // M4.2: Auto-collect coin pickups — walk over scattered floor coins
      if(f.coinPickups){
        for(const cp of f.coinPickups){
          if(!cp.taken&&dist(nx,ny,cp.x,cp.y)<38){
            cp.taken=true;
            const newTotal=totalCoinsRef.current+1;
            totalCoinsRef.current=newTotal;
            setTotalCoins(newTotal);
            coinsEarnedThisRunRef.current+=1;
            try{storage.set(COINS_KEY,String(newTotal));}catch(e){}
            Vibration.vibrate([0,30,20,50]);
            showMsg('🪙 +1 coin!',1200);
          }
        }
      }

      // ── END PLAYER-TRIGGERED FREEZE if expired ───────────────────────────
      if(freezeActiveRef.current && frozenUntilRef.current>0 && now>=frozenUntilRef.current){
        freezeActiveRef.current=false;
        setFreezeActive(false);
        frozenUntilRef.current=0;
        setFrozenUntil(0);
        showMsg('❄ Freeze ended. Ghosts are back!');
      }

      // ── AUTO-COLLECT PUSH PICKUPS ── walk over = +1 push charge ──────────
      if(f.pushPickups){
        for(const pp of f.pushPickups){
          if(!pp.taken && dist(nx,ny,pp.x,pp.y)<INTERACT_RADIUS+10){
            pp.taken=true;
            const next=invRef.current.pushCharges+1;
            invRef.current={...invRef.current,pushCharges:next};
            setInv({...invRef.current});
            showMsg(`💥 Push charge collected! (${next} total)`);
            Vibration.vibrate([0,50,30,80]);
          }
        }
      }

      // ── GHOST ZONE AI ──────────────────────────────────────────────────────
      // Ghosts randomly wander inside their zone during patrol.
      // They enter ALERT then CHASE when the player steps into their zone.
      // They NEVER deal damage unless actively chasing — no "sting while still".
      // Dark Mode overrides all: ghosts hard-chase everywhere.
      const loud=canUseAV&&darkMicRef.current.phase==='active'&&micDbRef.current>MIC_THRESHOLD_DB;
      const darkActive = darkMicRef.current.phase==='active';
      const pl=playerRef.current;

      for(const e of enemiesRef.current){
        if(e.kind==='PANIC'){
          e.state='chase';
        } else if(darkActive){
          // ── DARK MODE: ghosts only leave zone if they HEAR a sound ──
          // Mic is loud enough → ghost detected sound → chase player
          if(loud && dist(pl.x,pl.y,e.x,e.y)<=MIC_LURE_RADIUS){
            e.state='chase';
            e.alertUntil=now+(GHOST_ALERT_LINGER*2); // linger longer after sound
            e.soundLured=true;
          } else if(e.state==='chase' && now<e.alertUntil){
            // Still lingering from sound — keep chasing briefly
          } else if(e.state==='chase' && now>=e.alertUntil){
            // Linger expired — return ghost to zone patrol
            e.state='patrol';
            e.wanderTarget=null;
            e.soundLured=false;
          } else {
            // No sound: ghost patrols its zone normally even in dark mode
            e.state='patrol';
          }
        } else {
          // Normal mode: zone-based state machine
          const dToPlayer    = dist(pl.x,pl.y,e.x,e.y);
          const dToZoneCenter= dist(pl.x,pl.y,e.zone.cx,e.zone.cy);
          const playerInZone = dToZoneCenter < e.zone.r + GHOST_ZONE_SENSE;

          if(e.state==='patrol'){
            if(playerInZone) e.state='alert';
          } else if(e.state==='alert'){
            if(dToPlayer < GHOST_CHASE_RANGE)       e.state='chase';
            else if(!playerInZone && now>e.alertUntil) e.state='patrol';
            else if(playerInZone)                    e.alertUntil=now+GHOST_ALERT_LINGER;
          } else if(e.state==='chase'){
            if(dToPlayer > GHOST_FORGET_DIST){
              e.state='alert';
              e.alertUntil=now+GHOST_ALERT_LINGER;
            }
          }
        }

        // ── Frozen check — skip movement if frozen ──
        if(e.frozenUntil>now){continue;}

        // ── Movement ────────────────────────────────────────────────────────
        let tx,ty,spd;
        if(e.state==='chase'){
          tx=pl.x; ty=pl.y;
          const fastMult=e.kind==='FAST'?1.55:e.kind==='PHASE'?1.30:1;
          spd=GHOST_SPD_CHASE*fastMult*(panicRef.current.active&&e.kind==='PANIC'?1.5:1)*(loud?MIC_ENEMY_SPD_BOOST:1);
        } else if(e.state==='alert'){
          // Return toward zone center while staying alert
          tx=e.zone.cx; ty=e.zone.cy; spd=GHOST_SPD_ALERT;
        } else {
          // Patrol: random wander within zone circle — pick new target when reached
          if(!e.wanderTarget || dist(e.x,e.y,e.wanderTarget.x,e.wanderTarget.y)<28){
            const angle = Math.random()*Math.PI*2;
            const r     = 0.35*e.zone.r + Math.random()*e.zone.r*0.55; // stay active mid-zone
            e.wanderTarget = {
              x: clamp(e.zone.cx + Math.cos(angle)*r, ENEMY_R+10, WORLD_W-ENEMY_R-10),
              y: clamp(e.zone.cy + Math.sin(angle)*r, ENEMY_R+10, WORLD_H-ENEMY_R-10),
            };
          }
          tx=e.wanderTarget.x; ty=e.wanderTarget.y;
          spd=GHOST_SPD_PATROL*(e.kind==='FAST'?1.5:1);
        }

        const dx=tx-e.x,dy=ty-e.y,mag=Math.max(0.0001,Math.sqrt(dx*dx+dy*dy));
        let ex=e.x+(dx/mag)*spd*k,ey=e.y+(dy/mag)*spd*k;
        if(e.kind==='FAST'){
          // FAST ghosts (floor 4) phase through interior walls — only stopped by world edge
          e.x=clamp(ex,ENEMY_R+32,WORLD_W-ENEMY_R-32);
          e.y=clamp(ey,ENEMY_R+32,WORLD_H-ENEMY_R-32);
        } else if(e.kind==='PHASE'){
          // PHASE ghost: passes through ALL walls, only world boundary stops it
          e.x=clamp(ex,ENEMY_R,WORLD_W-ENEMY_R);
          e.y=clamp(ey,ENEMY_R,WORLD_H-ENEMY_R);
        } else {
          let blocked=false;
          for(const w of walls){if(circleRect(ex,ey,ENEMY_R,w.x,w.y,w.w,w.h)){blocked=true;break;}}
          if(!blocked){e.x=clamp(ex,ENEMY_R,WORLD_W-ENEMY_R);e.y=clamp(ey,ENEMY_R,WORLD_H-ENEMY_R);}
        }
      }


      // ── AUDIO CHECKS — throttled to max once per 80ms so they never slow the game loop ──
      if(canUseAV && now-lastAudioCheckRef.current>80){
        lastAudioCheckRef.current=now;
        const sndOn = soundEnabledRef.current;

        // FOOTSTEP SOUND — play while any movement button held, only when sound enabled
        const isMoving=mv.up||mv.down||mv.left||mv.right;
        if(sndOn && isMoving&&!stepsPlayingRef.current){
          stepsPlayingRef.current=true;
          (async()=>{try{if(stepsRef.current)await stepsRef.current.playAsync();}catch(e){/* ignore */}})();
        } else if((!sndOn || !isMoving)&&stepsPlayingRef.current){
          stepsPlayingRef.current=false;
          (async()=>{try{if(stepsRef.current)await stepsRef.current.pauseAsync();}catch(e){/* ignore */}})();
        }

        // GHOST VOICE — single instance, restarts from beginning on each new entry
        // .some() means 2+ ghosts at same time = still only one sound, no overlap
        const nearGhost=sndOn&&enemiesRef.current.some(e=>dist(pl.x,pl.y,e.zone.cx,e.zone.cy)<e.zone.r+GHOST_VOICE_RANGE);
        if(nearGhost&&!ghostVoicePlayingRef.current){
          ghostVoicePlayingRef.current=true;
          (async()=>{try{if(ghostVoiceRef.current){
            await ghostVoiceRef.current.stopAsync();
            await ghostVoiceRef.current.setPositionAsync(0);
            await ghostVoiceRef.current.playAsync();
          }}catch(e){/* ignore */}})();
        } else if(!nearGhost&&ghostVoicePlayingRef.current){
          ghostVoicePlayingRef.current=false;
          (async()=>{try{if(ghostVoiceRef.current){
            await ghostVoiceRef.current.stopAsync();
            await ghostVoiceRef.current.setPositionAsync(0);
          }}catch(e){/* ignore */}})();
        }
      }


      // ── HIT DETECTION — only chase-state ghosts can damage the player ──────
      if(now-lastHitRef.current>ENEMY_HIT_COOLDOWN_MS){
        for(const e of enemiesRef.current){
          // Ghost must be in chase state to sting — patrolling/alert ghosts don't hurt
          if(e.state==='chase' && dist(pl.x,pl.y,e.x,e.y)<PLAYER_R+ENEMY_R-2){
            lastHitRef.current=now;
            cancelCapture();

            // Shield absorbs one hit if armed and has charges
            if(invRef.current.shieldArmed && invRef.current.shieldCharges>0){
              const nextCharges=Math.max(0,invRef.current.shieldCharges-1);
              setInvSafe({
                shieldCharges: nextCharges,
                shieldArmed: nextCharges>0 ? invRef.current.shieldArmed : false,
              });
              Vibration.vibrate(35);
              showMsg('🛡 Shield absorbed the hit.');
              break;
            }

            const nh=clamp(heartsRef.current-1,0,floorMaxHeartsRef.current);
            heartsRef.current=nh;setHearts(nh);
            Vibration.vibrate([0,150,60,280]);
            if(nh<=0){cancelAnimationFrame(raf);finishRun('dead');return;}
            break;
          }
        }
      }

      // ── CAPTURE ─────────────────────────────────────────────────────────
      const cap=captureRef.current;
      if(cap){
        const elapsed=now-cap.startedAt;
        const progress01=clamp(elapsed/cap.durationMs,0,1);
        const kt=keysTakenRef.current;
        const keyOk=!kt[fi]&&!f.key.taken&&dist(pl.x,pl.y,f.key.x,f.key.y)<INTERACT_RADIUS;
        const bandOk=!!(f.bandage&&!f.bandage.taken&&dist(pl.x,pl.y,f.bandage.x,f.bandage.y)<INTERACT_RADIUS);
        const killOk=f.killOrb&&!f.killOrb.taken&&dist(pl.x,pl.y,f.killOrb.x,f.killOrb.y)<INTERACT_RADIUS;
        const spdOk=f.speedBoost&&!f.speedBoost.taken&&dist(pl.x,pl.y,f.speedBoost.x,f.speedBoost.y)<INTERACT_RADIUS;
        const shOk=f.shieldPower&&!f.shieldPower.taken&&dist(pl.x,pl.y,f.shieldPower.x,f.shieldPower.y)<INTERACT_RADIUS;
        const stillNear=(
          (cap.type==='KEY'&&keyOk)||(cap.type==='BANDAGE'&&bandOk)||
          (cap.type==='KILL'&&killOk)||(cap.type==='SPEED'&&spdOk)||
          (cap.type==='SHIELD'&&shOk)
        );
        if(!stillNear){cancelCapture();}
        else{
          if(now-lastRenderCapture>RENDER_CAPTURE_MS){lastRenderCapture=now;setCaptureUI({visible:true,type:cap.type,progress01});}
          if(progress01>=1){
            if(cap.type==='KEY'){
              f.key.taken=true;  // mark on floor object too — double protection
              setKeysTaken(prev=>{
                const next=[...prev];next[fi]=true;keysTakenRef.current=next;
                const got=next.filter(Boolean).length;
                showMsg(got===4?'ALL 4 KEYS COLLECTED — reach Floor 4 elevator!': `Key ${got}/4 collected!`, 2500);
                return next;
              });
            } else if(cap.type==='BANDAGE'){
              f.bandage.taken=true;
              setInvSafe({ bandagesCollected: invRef.current.bandagesCollected+1 });

              // Bandage logic:
              // If hearts not full: restore to full.
              // If full: increase max hearts up to 5, then restore.
              const cur=heartsRef.current;
              const curMax=floorMaxHeartsRef.current;
              if(cur<curMax){
                heartsRef.current=curMax;
                setHearts(curMax);
              }else{
                const nextMax=Math.min(MAX_HEARTS_CAP, curMax+1);
                floorMaxHeartsRef.current=nextMax;
                setFloorMaxHearts(nextMax);
                heartsRef.current=nextMax;
                setHearts(nextMax);
              }
            } else if(cap.type==='KILL'){
              // Kill the nearest ghost permanently
              f.killOrb.taken=true;
              let closest=null,closestD=Infinity;
              for(const e of enemiesRef.current){const d=dist(pl.x,pl.y,e.x,e.y);if(d<closestD){closestD=d;closest=e;}}
              if(closest){enemiesRef.current=enemiesRef.current.filter(e=>e!==closest);}
            } else if(cap.type==='SPEED'){
              f.speedBoost.taken=true;
              // Unlock sprint AND reset the one-use flag so this new pickup can be used
              setInvSafe({ speedUnlocked:true, sprintUsed:false });
              showMsg('⚡ Speed unlocked! Double-tap a direction to sprint for 30s (one use).');
            } else if(cap.type==='SHIELD'){
              f.shieldPower.taken=true;
              const nextCharges=invRef.current.shieldCharges+1;
              setInvSafe({ shieldCharges: nextCharges });
              showMsg('🛡 Shield charge collected.');
            }
            cancelCapture();
          }
        }
      }

      // ── THROTTLED RENDERS ──────────────────────────────────────────────────
      if(now-lastRenderPlayer>RENDER_PLAYER_MS){lastRenderPlayer=now;setPlayer({...playerRef.current});}
      if(now-lastRenderEnemies>RENDER_ENEMIES_MS){
        lastRenderEnemies=now;
        setEnemyStates(enemiesRef.current.map(e=>({x:e.x,y:e.y,state:e.state,kind:e.kind,zone:e.zone,frozenUntil:e.frozenUntil||0})));
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>{if(raf)cancelAnimationFrame(raf);};
  },[screen,canUseAV,micEnabled,elevatorBusy]);

  // ── RESET ────────────────────────────────────────────────────────────────────
  const resetAll=useCallback(()=>{
    const _newBuild=buildFloors();
    floorsRef.current=_newBuild.floors;
    visitOrderRef.current=_newBuild.visitOrder;
    setVisitSeq(_newBuild.visitOrder);
    enemiesRef.current=[];
    secondKeyTimeRef.current=null;
    setKeysTaken([false,false,false,false]);keysTakenRef.current=[false,false,false,false];
    const startH=FLOOR_START_HEARTS[0]; setHearts(startH);heartsRef.current=startH; floorMaxHeartsRef.current=startH;setFloorMaxHearts(startH);
    setPanic({active:false,startsAt:0,endsAt:0});panicRef.current={active:false,startsAt:0,endsAt:0};
    setFloorIndex(_newBuild.visitOrder[0]);floorIndexRef.current=_newBuild.visitOrder[0];
    const f0=floorsRef.current[_newBuild.visitOrder[0]];
    setPlayer({x:f0.spawn.x,y:f0.spawn.y});playerRef.current={x:f0.spawn.x,y:f0.spawn.y};
    moveRef.current={up:false,down:false,left:false,right:false};
    captureRef.current=null;setCaptureUI({visible:false,type:null,progress01:0});
    setElevatorBusy(false);doorsProgress.setValue(0);setDoorsVisible(false);setDoorsLabel('ELEVATOR');setElevatorRide({visible:false,sec:0,fromFloor:0,toFloor:1});
    lastHitRef.current=0;setEnemyStates([]);
    frozenUntilRef.current=0;setFrozenUntil(0);
    speedBoostUntilRef.current=0;setSpeedBoosted(false);

    // NEW: reset inventory, sprint, darkMic
    setInv({speedUnlocked:false,sprintUsed:false,shieldCharges:0,shieldArmed:false,bandagesCollected:0,pushCharges:2,freezeCharges:0});
    invRef.current={speedUnlocked:false,sprintUsed:false,shieldCharges:0,shieldArmed:false,bandagesCollected:0,pushCharges:2,freezeCharges:0};
    setFreezeActive(false);freezeActiveRef.current=false;
    floorsCompletedThisRunRef.current=0;
    coinsEarnedThisRunRef.current=0;
    // M4.2: Reset continue cost on new run
    continueCostRef.current=CONTINUE_COST_BASE;
    setContinueCost(CONTINUE_COST_BASE);   // reset displayed cost for new game
    continueCountRef.current=0;

    setSprint({active:false,endsAt:0});
    sprintRef.current={active:false,endsAt:0};
    lastTapRef.current={up:0,down:0,left:0,right:0};

    setDarkMic({phase:'idle',countdown:0,endsAt:0});
    darkMicRef.current={phase:'idle',countdown:0,endsAt:0};
    darkMicTickRef.current=0;
    darkMicCheckRef.current=Date.now();

    setUiMsg({text:'',until:0});
    uiMsgRef.current={text:'',until:0};
  },[doorsProgress]);

  const startGame=useCallback(()=>{resetAll();runStartRef.current=Date.now();setSilenceAlarm(true);setScreen('play');},[resetAll]);

  const finishRun = useCallback(async(outcome, extra={})=>{
    const endAt = Date.now();
    const startAt = runStartRef.current || endAt;
    const dur = Math.max(0, endAt - startAt);

    // Always read from ref — never from stale closure
    const prev = statsRef.current;
    const next = { ...prev };
    next.totalPlayMs = (prev.totalPlayMs || 0) + dur;
    next.totalRuns   = (prev.totalRuns   || 0) + 1;

    let brokeRecord = false;
    let best = prev.bestEscapeMs || 0;

    if(outcome === 'win'){
      next.escapes = (prev.escapes || 0) + 1;
      floorsCompletedThisRunRef.current += 1;
      const winCoinGain = floorsCompletedThisRunRef.current;
      const newCTWin = totalCoinsRef.current + winCoinGain;
      totalCoinsRef.current = newCTWin;
      setTotalCoins(newCTWin);
      try{ await storage.set(COINS_KEY, String(newCTWin)); }catch(e){}
      next.coins = (prev.coins||0) + coinsEarnedThisRunRef.current + winCoinGain;
      if(best === 0 || dur < best){
        best = dur;
        next.bestEscapeMs = best;
        brokeRecord = (prev.bestEscapeMs || 0) > 0;
      }
    } else if(outcome === 'dead'){
      next.deaths = (prev.deaths || 0) + 1;
      const deathCoins = floorsCompletedThisRunRef.current;
      if(deathCoins > 0){
        const newCT = totalCoinsRef.current + deathCoins;
        totalCoinsRef.current = newCT;
        setTotalCoins(newCT);
        try{ await storage.set(COINS_KEY, String(newCT)); }catch(e){}
        next.coins = (prev.coins||0) + deathCoins;
      }
    }

    // Keep ref and state in sync
    statsRef.current = next;
    setStats(next);
    await saveStats(next);

    try{
      await storage.set(LASTRESULT_KEY, JSON.stringify({ outcome, durMs: dur, at: endAt, ...extra }));
    }catch(e){/* ignore */}

    if(outcome === 'dead'){
      // Sync totalCoins state from ref so DeadScreen shows the accurate balance
      setTotalCoins(totalCoinsRef.current);
      setScreen('dead');
      return;
    }

    // Win — navigate to Results screen
    if(navigation && typeof navigation.replace === 'function'){
      navigation.replace('Results', { outcome, durMs: dur, bestEscapeMs: best, brokeRecord, ...extra });
      return;
    }
    setWinData({durMs:dur, bestEscapeMs:best, brokeRecord});
    setScreen('win');
  },[navigation, saveStats]);


  const onTypingDone = useCallback(() => { startGame(); }, [startGame]);

  // ── ELEVATOR ─────────────────────────────────────────────────────────────────
  const allKeys=keysTaken.filter(Boolean).length===4;
  const animDoors=(toValue,duration)=>new Promise(res=>{Animated.timing(doorsProgress,{toValue,duration,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}).start(()=>res());});

  const elevatorSequence=useCallback(async()=>{
    if(elevatorBusy)return;
    if(panicRef.current.active)return;
    if(captureRef.current){captureRef.current=null;setCaptureUI({visible:false,type:null,progress01:0});}

    const cur=floorIndexRef.current;

    // On floor index 3 with ALL 4 keys → WIN (open the door)
    if(cur>=3 && keysTakenRef.current.filter(Boolean).length===4){
      setElevatorBusy(true);
      try{
        elevatorRideRef.current={visible:true,sec:0,fromFloor:cur,toFloor:4};
        setElevatorRide({...elevatorRideRef.current});
        await new Promise(r=>setTimeout(r,1800));
        await new Promise(r=>setTimeout(r,3600));
        elevatorRideRef.current={visible:false,sec:0,fromFloor:0,toFloor:1};
        setElevatorRide({...elevatorRideRef.current});
        finishRun('win');
        return;
      }finally{
        elevatorRideRef.current={visible:false,sec:0,fromFloor:0,toFloor:1};
        setElevatorRide({...elevatorRideRef.current});
        setElevatorBusy(false);
      }
    }

    // Free navigation: cycle 0→1→2→3→0→1→... always
    // (on floor 3 without all keys, wraps back to floor 0)
    // Find next slot to visit using shuffled visitOrder
    const vo=visitOrderRef.current;
    const posInSeq=vo.indexOf(cur);
    const next=posInSeq>=0 ? vo[(posInSeq+1)%4] : vo[0];

    setElevatorBusy(true);
    try{
      elevatorRideRef.current={visible:true,sec:0,fromFloor:cur,toFloor:next};
      setElevatorRide({...elevatorRideRef.current});

      await new Promise(r=>setTimeout(r,1800));

      const nextFloor=floorsRef.current[next];
      enemiesRef.current=nextFloor.enemies.map(e=>({...e,patrolIndex:0,frozenUntil:0,wanderTarget:null}));
      playerRef.current={x:nextFloor.spawn.x,y:nextFloor.spawn.y};
      setPlayer({x:nextFloor.spawn.x,y:nextFloor.spawn.y});
      floorIndexRef.current=next;setFloorIndex(next);
      frozenUntilRef.current=0;setFrozenUntil(0);
      freezeActiveRef.current=false;setFreezeActive(false);
      // Only reset freeze (per-floor pickup) — push, shield, speed, hearts persist
      invRef.current={...invRef.current,freezeCharges:0};
      setInv({...invRef.current});

      await new Promise(r=>setTimeout(r,3400));

      // ── COIN REWARD: completed this floor ────────────────────────────────
      floorsCompletedThisRunRef.current += 1;
      const floorCoinReward = floorsCompletedThisRunRef.current; // floor 1=1, 2=2, 3=3 coin
      coinsEarnedThisRunRef.current += floorCoinReward;
      const newCoinTotal = totalCoinsRef.current + floorCoinReward;
      totalCoinsRef.current = newCoinTotal;
      setTotalCoins(newCoinTotal);
      try{ await storage.set(COINS_KEY, String(newCoinTotal)); }catch(e){}
      showMsg(`🪙 +${floorCoinReward} coin${floorCoinReward!==1?'s':''}! (Floor ${floorsCompletedThisRunRef.current} done)`, 2000);

      elevatorRideRef.current={visible:false,sec:0,fromFloor:0,toFloor:1};
      setElevatorRide({...elevatorRideRef.current});
      setPreviewTrigger(t=>t+1);
    }finally{
      elevatorRideRef.current={visible:false,sec:0,fromFloor:0,toFloor:1};
      setElevatorRide({...elevatorRideRef.current});
      setElevatorBusy(false);
    }
  },[elevatorBusy, finishRun, showMsg]);

  // ── INIT ENEMIES on floor load ────────────────────────────────────────────────
  useEffect(()=>{
    if(screen==='play'){
      const f=floorsRef.current[floorIndex];
      enemiesRef.current=f.enemies.map(e=>({...e,patrolIndex:0,frozenUntil:0,wanderTarget:null}));
      setEnemyStates(f.enemies.map(e=>({x:e.x,y:e.y,state:e.state,kind:e.kind,zone:e.zone,frozenUntil:0})));
      // Hearts, push charges, shield and speed PERSIST between floors.
      // Only set starting hearts on the very first floor load (floorIndex===0 and hearts at init value).
      if(floorIndex===visitOrderRef.current[0]){
        const fh=FLOOR_START_HEARTS[0]??3;
        floorMaxHeartsRef.current=fh;setFloorMaxHearts(fh);
        heartsRef.current=fh;setHearts(fh);
      }
      // freeze resets each floor (per-floor pickup) — handled in elevatorSequence already
    }
  },[screen,floorIndex]);

  // ── PREVIEW: show full lit maze for 15s when entering each floor ────────────
  // FIX: use setTimeout chain instead of setInterval to avoid React batching
  // race conditions where preview state gets stuck at true.
  const previewTimerRef = useRef(null);
  useEffect(()=>{
    if(screen!=='play')return;
    if(previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewZoomAnim.stopAnimation();
    previewZoomAnim.setValue(0);
    previewRef.current = true;
    setPreview(true);
    setPreviewSec(15);
    let remaining = 15;
    const step = () => {
      remaining -= 1;
      if(remaining > 0){
        setPreviewSec(remaining);
        previewTimerRef.current = setTimeout(step, 1000);
      } else {
        setPreviewSec(0);
        previewRef.current = false;
        setPreview(false);
        previewTimerRef.current = null;
        Animated.timing(previewZoomAnim,{toValue:1,duration:1200,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}).start();
      }
    };
    previewTimerRef.current = setTimeout(step, 1000);
    return()=>{
      if(previewTimerRef.current){clearTimeout(previewTimerRef.current);previewTimerRef.current=null;}
      previewZoomAnim.stopAnimation();
      previewRef.current=false;
    };
  },[screen,previewTrigger]);

  // ── DERIVED UI ────────────────────────────────────────────────────────────────
  const pl=player,fi=floorIndex,cf=currentFloor;
  const keyAvailable=!keysTaken[fi] && !cf.key.taken;
  const bandAvailable=!!(cf.bandage&&!cf.bandage.taken);
  const nearKey=keyAvailable&&dist(pl.x,pl.y,cf.key.x,cf.key.y)<INTERACT_RADIUS;
  const nearBand=bandAvailable&&!!cf.bandage&&dist(pl.x,pl.y,cf.bandage.x,cf.bandage.y)<INTERACT_RADIUS;
  const nearKill=!!(cf.killOrb&&!cf.killOrb.taken&&dist(pl.x,pl.y,cf.killOrb.x,cf.killOrb.y)<INTERACT_RADIUS);
  const nearSpeed=!!(cf.speedBoost&&!cf.speedBoost.taken&&dist(pl.x,pl.y,cf.speedBoost.x,cf.speedBoost.y)<INTERACT_RADIUS);
  const nearShield=!!(cf.shieldPower&&!cf.shieldPower.taken&&dist(pl.x,pl.y,cf.shieldPower.x,cf.shieldPower.y)<INTERACT_RADIUS);
  const nearFreeze=!!(cf.freezeGun&&!cf.freezeGun.taken&&dist(pl.x,pl.y,cf.freezeGun.x,cf.freezeGun.y)<INTERACT_RADIUS+10); // just for rendering glow

  const nearDoor=!!(cf.escapeDoor&&aabbOverlap(
    pl.x-PLAYER_R,pl.y-PLAYER_R,PLAYER_R*2,PLAYER_R*2,
    cf.escapeDoor.x,cf.escapeDoor.y,cf.escapeDoor.w,cf.escapeDoor.h
  ));
  const inElevator=aabbOverlap(pl.x-PLAYER_R,pl.y-PLAYER_R,PLAYER_R*2,PLAYER_R*2,cf.elevator.x,cf.elevator.y,cf.elevator.w,cf.elevator.h);
  // Push button only lights up when a ghost is within 320 units
  const PUSH_RANGE_UI = 320;
  const ghostIsClose = !freezeActive && enemyStates.some(e=>dist(pl.x,pl.y,e.x,e.y)<=PUSH_RANGE_UI);
  const canCapture=!elevatorBusy&&(nearKey||nearBand||nearKill||nearSpeed||nearShield);
  const captureLabel=nearKey?'CAPTURE KEY':nearBand?'BANDAGE':nearKill?'💀 KILL':nearShield?'🛡 SHIELD':nearSpeed?'⚡ SPEED':'CAPTURE';

  const onCaptureDown=(forceType=null)=>{
    if(elevatorBusy)return;

    // Escape Door is tap, not hold
    if(forceType==='DOOR' || (forceType===null && nearDoor)){
      if(!allKeys){
        Alert.alert('Locked','You need all 4 keys to open the escape door.');
        return;
      }
      finishRun('win');
      return;
    }

    if(!canCapture||captureRef.current)return;
    let type,durationMs;
    if(nearKey){type='KEY';durationMs=KEY_HOLD_MS;}
    else if(nearBand){type='BANDAGE';durationMs=BANDAGE_HOLD_MS;}
    else if(nearShield){type='SHIELD';durationMs=SHIELD_HOLD_MS;}
    else if(nearSpeed){type='SPEED';durationMs=SPEED_HOLD_MS;}
    else if(nearKill){type='KILL';durationMs=KILL_ORB_HOLD_MS;}
    else return;
    captureRef.current={type,startedAt:Date.now(),durationMs};
    setCaptureUI({visible:true,type,progress01:0});
  };
  const onCaptureUp=()=>{if(!captureRef.current)return;captureRef.current=null;setCaptureUI({visible:false,type:null,progress01:0});};

  // During player-triggered freeze: hide all ghosts, show full lit map (like preview)
  const visibleEnemies=preview||freezeActive?[]:enemyStates.filter(e=>dist(pl.x,pl.y,e.x,e.y)<=ENEMY_SHOW_RADIUS);
  const anyChasing=freezeActive?false:enemyStates.some(e=>e.state==='chase');
  const anyAlert=freezeActive?false:enemyStates.some(e=>e.state==='alert');
  const panicSec=panic.active?Math.ceil(Math.max(0,panic.endsAt-Date.now())/1000):0;

  const hintText=(()=>{
    if(elevatorBusy)return 'Elevator in use…';
    if(captureUI.visible)return 'Keep holding…';
    if(freezeActive)return `❄ FREEZE ACTIVE — Ghosts hidden! ${Math.max(0,Math.ceil((frozenUntil-Date.now())/1000))}s left`;
    if(anyChasing)return `⚠ GHOST CHASING — RUN! (💥 PUSH kills if close)`;
    if(anyAlert)return '? Ghost noticed something. Be careful.';
    if(nearDoor)return 'Tap OPEN DOOR (bonus shortcut!)';
    if(nearKey)return `Hold CAPTURE to take the key — then reach the elevator!`;
    if(nearBand)return 'Hold BANDAGE to collect (5s)';
    if(nearShield)return 'Hold SHIELD to collect (5s)';
    if(nearFreeze)return `❄ WALK OVER to collect freeze charge — press FREEZE to use!`;
    if(nearKill)return '💀 Hold KILL to eliminate the nearest ghost!';
    if(nearSpeed)return '⚡ Hold SPEED to unlock sprint (double tap to run)';
    if(frozenUntil>Date.now())return `❄ Ghosts frozen! ${Math.ceil((frozenUntil-Date.now())/1000)}s remaining`;
    if(inv.speedUnlocked && sprint.active && Date.now()<sprint.endsAt)return `⚡ Sprint active: ${Math.ceil((sprint.endsAt-Date.now())/1000)}s`;
    if(inElevator){
      const have=keysTaken.filter(Boolean).length;
      if(fi>=3 && have===4) return 'OPEN THE DOOR — you have all 4 keys! Escape!';
      const vo=visitOrderRef.current;
      const posInSeq=vo.indexOf(fi);
      const nextSlot=posInSeq>=0?vo[(posInSeq+1)%4]:vo[0];
      const nextFloorNum=nextSlot+1;
      return `ELEVATOR ready → Floor ${nextFloorNum}  (${have}/4 keys collected)`;
    }
    return 'Stay outside the zone rings. Ghosts guard their territory.';
  })();

  // ── SCREEN ROUTING ─────────────────────────────────────────────────────────
  // M4.1: Wrap all screens in GameContext.Provider so any component can access global state
  // 1. Intro video plays first (full-screen, tappable to skip)
  if(screen==='intro') return(
    <GameContext.Provider value={{totalCoins,profile}}>
      <IntroVideoScreen onDone={()=>{ setScreen(boot?'loading':'hub'); }} />
    </GameContext.Provider>
  );
  // 2. Loading splash (while boot timer runs, then auto-goes to hub)
  if(screen==='loading'||boot) return(
    <GameContext.Provider value={{totalCoins,profile}}>
      <LaunchScreen onReady={()=>setScreen('hub')} bootDone={!boot}/>
    </GameContext.Provider>
  );

  if(screen==='hub')return(
    <GameContext.Provider value={{totalCoins,profile}}>
      <HubTabs
        onStartGame={startFlow}
        profile={profile}
        setProfile={updateProfile}
        charData={charData}
        onEditCharacter={()=>setScreen('customize_profile')}
        openSettings={()=>{
          // Pass a delete-account callback so SettingsScreen can fully reset GameCore state
          const handleDeleteAccount = ()=>{
            // Wipe all in-memory state
            updateProfile({name:''});
            charDataRef.current=null;
            setCharData(null);
            totalCoinsRef.current=0;
            setTotalCoins(0);
            setStats({totalPlayMs:0,bestEscapeMs:0,escapes:0,deaths:0});
            statsRef.current={totalPlayMs:0,bestEscapeMs:0,escapes:0,deaths:0};
            setSoundEnabled(true);
            soundEnabledRef.current=true;
            setMicEnabled(MIC_ENABLED_DEFAULT);
            resetAll();
            try{ navRef.current?.goBack(); }catch(e){}
            setScreen('hub');
          };
          navigation?.navigate?.('Settings', { onDeleteAccount: handleDeleteAccount });
        }}
        openAchievements={()=>navigation?.navigate?.('Achievements')}
      />
    </GameContext.Provider>
  );

  if(screen==='customize')return(
    <CharacterCreator
      onDone={async cd=>{
        charDataRef.current=cd;
        setCharData(cd);
        // Strip non-serializable require() image; re-resolved on load via _registryId
        const{spriteImage:_si,...saveable}=cd;
        await storage.set(CHAR_KEY, JSON.stringify(saveable));
        setScreen('typing');
      }}
      uiMsg={uiMsg}
      theme={THEMES[0]}
    />
  );

  if(screen==='customize_profile')return(
    <CharacterCreator
      onDone={async cd=>{
        charDataRef.current=cd;
        setCharData(cd);
        const{spriteImage:_si,...saveable}=cd;
        await storage.set(CHAR_KEY, JSON.stringify(saveable));
        setScreen('hub');
      }}
      uiMsg={uiMsg}
      theme={THEMES[0]}
    />
  );

  if(screen==='nameset')return(
    <NameSetup
      initialName={profile?.name ?? ''}
      onSave={async nm=>{
        const next={...profile,name:String(nm||'').trim()};
        updateProfile(next);  // updates both ref and state atomically
        await storage.set(PROFILE_KEY, JSON.stringify(next));
        if(!charDataRef.current){ setScreen('customize'); return; }
        setScreen('typing');
      }}
      onBack={()=>setScreen('hub')}
    />
  );

  if(screen==='typing')return(
    <TypingIntro
      name={(profile?.name && String(profile.name).trim()) ? String(profile.name).trim() : 'Human'}
      onDone={onTypingDone}
    />
  );

  if(screen==='dead')return(
    <DeadScreen
      charData={charData}
      floorNum={floorIndex+1}
      totalCoins={totalCoins}
      continueCost={continueCost}
      onContinuePaid={async()=>{
        // Deduct coins, double next cost, revive player on same floor
        const cost = continueCostRef.current;
        const newCoins = totalCoinsRef.current - cost;
        totalCoinsRef.current = newCoins;
        setTotalCoins(newCoins);
        continueCostRef.current = cost * 2;
        setContinueCost(cost * 2);
        continueCountRef.current += 1;
        try{ await storage.set(COINS_KEY, String(newCoins)); }catch(e){}

        // Revive on same floor — use floorIndexRef (not stale closure floorIndex)
        const fi = floorIndexRef.current;
        const f  = floorsRef.current[fi];
        enemiesRef.current = f.enemies.map(e=>({...e,patrolIndex:0,frozenUntil:0,wanderTarget:null}));
        playerRef.current  = {x:f.spawn.x, y:f.spawn.y};
        setPlayer({x:f.spawn.x, y:f.spawn.y});

        // Restore hearts — use current floorMaxHeartsRef so bandage boosts persist
        const fh = floorMaxHeartsRef.current || MAX_HEARTS;
        heartsRef.current = fh; setHearts(fh);

        // Reset floor-scoped state but keep inventory (shield charges, push, speed, bandages)
        // Only reset sprintUsed so they can sprint again if they have the pickup
        invRef.current = {...invRef.current, sprintUsed:false};
        setInv({...invRef.current});

        captureRef.current = null; setCaptureUI({visible:false,type:null,progress01:0});
        lastHitRef.current = 0; frozenUntilRef.current = 0; setFrozenUntil(0);
        freezeActiveRef.current = false; setFreezeActive(false);
        setPanic({active:false,startsAt:0,endsAt:0}); panicRef.current={active:false,startsAt:0,endsAt:0};
        setDarkMic({phase:'idle',countdown:0,endsAt:0}); darkMicRef.current={phase:'idle',countdown:0,endsAt:0};
        setElevatorBusy(false);
        runStartRef.current = Date.now();
        setPreviewTrigger(t=>t+1);
        setScreen('play');
      }}
      onMenu={()=>setScreen('hub')}
    />
  );
  if(screen==='win')return<WinScreen charData={charData} durMs={winData.durMs} bestEscapeMs={winData.bestEscapeMs} brokeRecord={winData.brokeRecord} escapes={stats.escapes} onPlay={()=>setScreen('typing')} onMenu={()=>setScreen('hub')}/>;
// ── PLAY ─────────────────────────────────────────────────────────────────────
  return(
    <View style={{width:SW, height:SH, backgroundColor:theme.bg, overflow:'hidden', position:'relative'}}>
      <StatusBar hidden/>

      {/* HUD — slim single row */}
      <View style={{
        height:HUD_H,flexDirection:'row',alignItems:'center',justifyContent:'space-between',
        paddingHorizontal:12,backgroundColor:theme.bg2,
        borderBottomWidth:1,borderBottomColor:theme.edge+'55',
      }}>
        {/* left: title + difficulty + floor status */}
        <View style={{flexDirection:'row',alignItems:'center',gap:6,flexShrink:1,flexGrow:0,maxWidth:'55%'}}>
          <Text style={{color:theme.accent,fontWeight:'900',fontFamily:'monospace',fontSize:11,letterSpacing:2}} numberOfLines={1}>
            THE LAST FLOOR
          </Text>
          <View style={{
            paddingHorizontal:8,paddingVertical:2,borderRadius:4,
            backgroundColor:anyChasing?theme.chaseColor+'33':anyAlert?theme.alertColor+'22':theme.edge+'22',
            borderWidth:1,borderColor:anyChasing?theme.chaseColor:anyAlert?theme.alertColor:theme.edge,
          }}>
            <Text style={{color:anyChasing?theme.chaseColor:anyAlert?theme.alertColor:theme.accent,
              fontFamily:'monospace',fontSize:10,fontWeight:'900',letterSpacing:1}}>
              {anyChasing?'CHASE':anyAlert?'ALERT': keysTaken[floorIndex]?`KEY ${keysTaken.filter(Boolean).length}/4 GOT`:`KEY ${keysTaken.filter(Boolean).length}/4`}
            </Text>
          </View>
          {panic.active&&<Text style={{color:'#ff6688',fontFamily:'monospace',fontSize:10,fontWeight:'900'}}>
            ⚠ LOCKDOWN {panicSec}s
          </Text>}

          {darkMic.phase==='countdown'&&(
            <Text style={{color:'#d6c8ff',fontFamily:'monospace',fontSize:10,fontWeight:'900'}}>
              🌑 in {darkMic.countdown}
            </Text>
          )}
          {darkMic.phase==='active'&&(
            <Text style={{color:'#d6c8ff',fontFamily:'monospace',fontSize:10,fontWeight:'900'}}>
              🌑 {Math.ceil((darkMic.endsAt-Date.now())/1000)}s 🎙
            </Text>
          )}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:6,flexShrink:1}}>
          {frozenUntil>Date.now()&&<Text style={{color:'#88ddff',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>❄{Math.ceil((frozenUntil-Date.now())/1000)}s</Text>}
          {inv.speedUnlocked&&sprint.active&&Date.now()<sprint.endsAt&&(
            <Text style={{color:'#ffee44',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>⚡{Math.ceil((sprint.endsAt-Date.now())/1000)}s</Text>
          )}
          {inv.shieldCharges>0&&(
            <Text style={{color:inv.shieldArmed?'#66bbff':'rgba(102,187,255,0.65)',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>🛡{inv.shieldCharges}{inv.shieldArmed?'*':''}</Text>
          )}
          <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
            <Text style={{fontSize:10,opacity:inv.pushCharges>0?1:0.35}}>💥</Text>
            <Text style={{color:inv.pushCharges>0?'#ff8844':'rgba(255,120,60,0.40)',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>{inv.pushCharges}</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
            <Text style={{fontSize:10,opacity:inv.freezeCharges>0||freezeActive?1:0.35}}>❄️</Text>
            <Text style={{color:inv.freezeCharges>0?'#88ddff':freezeActive?'#55ccff':'rgba(100,180,220,0.35)',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>{inv.freezeCharges}{freezeActive?'▶':''}</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
            <Text style={{fontSize:10}}>🪙</Text>
            <Text style={{color:'#c9a44c',fontFamily:'monospace',fontSize:9,fontWeight:'900'}}>{totalCoins}</Text>
          </View>
          <HeartRow hearts={hearts} maxH={floorMaxHearts}/>
          {charData&&<ChibiCharacter charData={charData} size={1.0} flip/>}
          <TouchableOpacity onPress={openPause} activeOpacity={0.8}
            style={{width:30,height:30,borderRadius:9,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:theme.edge+'88',backgroundColor:theme.edge+'18'}}>
            <Text style={{color:'rgba(255,255,255,0.85)',fontFamily:'monospace',fontWeight:'900',fontSize:13}}>⏻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VIEWPORT */}
      <View style={{height:viewH,width:SW,overflow:'hidden',borderTopWidth:1,borderTopColor:theme.edge+'33',borderBottomWidth:1,borderBottomColor:theme.edge+'33'}}>
        <Animated.View style={{
          width:WORLD_W*ZOOM,height:WORLD_H*ZOOM,
          // React Native scale() transforms from the element CENTER.
          // Preview (anim=0): scale world down to previewScale and center it on screen.
          //   translateX = SW/2 - WORLD_W*ZOOM/2  (shift center to screen center)
          //   translateY = viewH/2 - WORLD_H*ZOOM/2
          // Normal (anim=1): no scaling, just camera offset.
          transform:[
            {translateX:previewZoomAnim.interpolate({inputRange:[0,1],outputRange:[
              SW/2 - (WORLD_W*ZOOM)/2,
              camera.translateX
            ]})},
            {translateY:previewZoomAnim.interpolate({inputRange:[0,1],outputRange:[
              viewH/2 - (WORLD_H*ZOOM)/2,
              camera.translateY
            ]})},
            {scale:previewZoomAnim.interpolate({inputRange:[0,1],outputRange:[previewScale,1]})},
          ],
        }}>
          <View style={{position:'absolute',left:0,top:0,width:WORLD_W*ZOOM,height:WORLD_H*ZOOM}}>

            {/* ── ADVANCED BACKGROUND ─────────────────────────────────────── */}
            <FloorBackground theme={theme} zoom={ZOOM}/>

            {/* ── GHOST ZONE RINGS (rendered under everything else) ─────────── */}
            {enemyStates.map((e,i)=>(
              <GhostZoneRing key={`zr${i}`} zone={e.zone} state={e.state} theme={theme} zoom={ZOOM}/>
            ))}

            {/* ── WALLS ────────────────────────────────────────────────────── */}
            {cf.walls.map((w,i)=>(
              <WallBlock key={`w${i}`} w={w} theme={theme} zoom={ZOOM}/>
            ))}

            {/* ── ELEVATOR ─────────────────────────────────────────────────── */}
            <View style={{
              position:'absolute',
              left:cf.elevator.x*ZOOM,top:cf.elevator.y*ZOOM,
              width:cf.elevator.w*ZOOM,height:cf.elevator.h*ZOOM,
              backgroundColor:inElevator?theme.accent+'28':'rgba(255,255,255,0.06)',
              borderWidth:inElevator?3:2,borderColor:inElevator?theme.accent:theme.edge+'77',
              borderRadius:14,justifyContent:'center',alignItems:'center',
              shadowColor:theme.accent,shadowRadius:inElevator?20*ZOOM:6*ZOOM,shadowOpacity:inElevator?0.8:0.3,
            }}>
              <View style={{position:'absolute',left:8,top:8,right:8,bottom:8,
                borderWidth:1,borderColor:theme.edge+'33',borderRadius:8}}/>
              <Text style={{color:inElevator?theme.accent:'rgba(255,255,255,0.5)',fontWeight:'900',
                fontSize:10*ZOOM,textAlign:'center',fontFamily:'monospace',letterSpacing:2}}>
                LIFT
              </Text>
              <View style={{flexDirection:'row',gap:6,marginTop:5}}>
                {[0,1,2,3].map(i=>(
                  <View key={i} style={{width:6*ZOOM,height:6*ZOOM,borderRadius:3*ZOOM,
                    backgroundColor:keysTaken[i]?theme.accent:theme.edge+'55',
                    shadowColor:theme.accent,shadowRadius:keysTaken[i]?4:0,shadowOpacity:0.9}}/>
                ))}
              </View>
            </View>

            {/* ── KEY — glowing beacon with spotlight floor glow ──────────── */}
            {keyAvailable&&(()=>{
              const kx=cf.key.x*ZOOM, ky=cf.key.y*ZOOM;
              return(
                <View key="keybeacon" style={{position:'absolute',left:0,top:0,width:0,height:0,pointerEvents:'none'}}>
                  {/* Floor spotlight glow — large soft circle on ground */}
                  <View style={{
                    position:'absolute',
                    left:kx-60*ZOOM, top:ky-60*ZOOM,
                    width:120*ZOOM, height:120*ZOOM,
                    borderRadius:60*ZOOM,
                    backgroundColor: nearKey?theme.accent+'44':theme.accent+'22',
                    shadowColor:theme.accent, shadowRadius:40*ZOOM, shadowOpacity:nearKey?0.9:0.55,
                  }}/>
                  {/* Outer pulse ring 1 */}
                  <View style={{
                    position:'absolute',
                    left:kx-45*ZOOM, top:ky-45*ZOOM,
                    width:90*ZOOM, height:90*ZOOM,
                    borderRadius:45*ZOOM,
                    borderWidth:nearKey?2.5*ZOOM:1.5*ZOOM,
                    borderColor:theme.accent+(nearKey?'cc':'66'),
                  }}/>
                  {/* Outer pulse ring 2 — slightly smaller */}
                  <View style={{
                    position:'absolute',
                    left:kx-32*ZOOM, top:ky-32*ZOOM,
                    width:64*ZOOM, height:64*ZOOM,
                    borderRadius:32*ZOOM,
                    borderWidth:1.5*ZOOM,
                    borderColor:theme.accent+(nearKey?'99':'44'),
                  }}/>
                  {/* Main key icon circle */}
                  <View style={{
                    position:'absolute',
                    left:kx-20*ZOOM, top:ky-20*ZOOM,
                    width:40*ZOOM, height:40*ZOOM,
                    borderRadius:20*ZOOM,
                    backgroundColor:nearKey?theme.accent+'88':theme.accent+'44',
                    borderWidth:nearKey?3*ZOOM:2*ZOOM,
                    borderColor:theme.accent,
                    justifyContent:'center',alignItems:'center',
                    shadowColor:theme.accent,shadowRadius:nearKey?20*ZOOM:10*ZOOM,shadowOpacity:1,
                  }}>
                    <Text style={{fontSize:18*ZOOM}}>🗝</Text>
                  </View>
                  {/* HOLD label when near */}
                  {nearKey&&(
                    <View style={{position:'absolute',left:kx-20*ZOOM,top:ky+24*ZOOM,
                      backgroundColor:theme.accent,paddingHorizontal:5,paddingVertical:2,borderRadius:4}}>
                      <Text style={{color:'black',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>HOLD</Text>
                    </View>
                  )}
                  {/* Direction arrow when not near — small beacon arrow */}
                  {!nearKey&&!preview&&(
                    <View style={{position:'absolute',left:kx-5*ZOOM,top:ky-34*ZOOM}}>
                      <Text style={{color:theme.accent,fontSize:10*ZOOM,opacity:0.7}}>▼</Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* ── BANDAGE ──────────────────────────────────────────────────── */}
            {bandAvailable&&(
              <View style={{
                position:'absolute',
                left:(cf.bandage.x-18)*ZOOM,top:(cf.bandage.y-18)*ZOOM,
                width:36*ZOOM,height:36*ZOOM,borderRadius:8,
                backgroundColor:nearBand?'rgba(100,220,140,0.45)':'rgba(60,140,80,0.22)',
                borderWidth:nearBand?2:1.5,borderColor:nearBand?'#88ffaa':'#55aa77',
                justifyContent:'center',alignItems:'center',
                shadowColor:'#44ee88',shadowRadius:nearBand?10*ZOOM:4*ZOOM,shadowOpacity:0.7,
              }}>
                <Text style={{color:nearBand?'#aaffcc':'#77cc99',fontWeight:'900',fontSize:20*ZOOM}}>✚</Text>
                {nearBand&&<View style={{position:'absolute',bottom:-16*ZOOM,alignSelf:'center',
                  backgroundColor:'#224433',paddingHorizontal:5,paddingVertical:1,borderRadius:4}}>
                  <Text style={{color:'#88ffcc',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>HOLD</Text>
                </View>}
              </View>
            )}

            {/* ── FREEZE PICKUP ─────────────────────────────────────────────── */}
            {cf.freezeGun&&!cf.freezeGun.taken&&(
              <View style={{
                position:'absolute',
                left:(cf.freezeGun.x-22)*ZOOM,top:(cf.freezeGun.y-22)*ZOOM,
                width:44*ZOOM,height:44*ZOOM,borderRadius:22*ZOOM,
                backgroundColor:nearFreeze?'rgba(100,220,255,0.25)':'rgba(40,120,200,0.12)',
                borderWidth:nearFreeze?2:1.5,borderColor:nearFreeze?'#aaeeff':'#5599bb',
                justifyContent:'center',alignItems:'center',
                shadowColor:'#88ddff',shadowRadius:nearFreeze?14*ZOOM:6*ZOOM,shadowOpacity:nearFreeze?0.95:0.5,
              }}>
                <Text style={{fontSize:28*ZOOM}}>❄️</Text>
                {nearFreeze&&<View style={{position:'absolute',bottom:-16*ZOOM,alignSelf:'center',backgroundColor:'rgba(20,80,140,0.9)',paddingHorizontal:5,paddingVertical:1,borderRadius:4}}>
                  <Text style={{color:'#aaeeff',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>WALK TO COLLECT</Text>
                </View>}
              </View>
            )}

            {/* ── KILL ORB ─────────────────────────────────────────────────── */}
            {cf.killOrb&&!cf.killOrb.taken&&(
              <View style={{
                position:'absolute',
                left:(cf.killOrb.x-20)*ZOOM,top:(cf.killOrb.y-20)*ZOOM,
                width:40*ZOOM,height:40*ZOOM,borderRadius:20*ZOOM,
                backgroundColor:nearKill?'rgba(255,30,60,0.55)':'rgba(160,0,30,0.30)',
                borderWidth:nearKill?2.5:1.5,borderColor:nearKill?'#ff4466':'#cc1133',
                justifyContent:'center',alignItems:'center',
                shadowColor:'#ff0033',shadowRadius:nearKill?14*ZOOM:6*ZOOM,shadowOpacity:0.9,
              }}>
                <Text style={{fontSize:20*ZOOM}}>💀</Text>
                {nearKill&&<View style={{position:'absolute',bottom:-16*ZOOM,alignSelf:'center',
                  backgroundColor:'rgba(160,0,30,0.9)',paddingHorizontal:5,paddingVertical:1,borderRadius:4}}>
                  <Text style={{color:'#ff9999',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>HOLD</Text>
                </View>}
              </View>
            )}

            {/* ── SPEED BOOST ──────────────────────────────────────────────── */}
            {cf.speedBoost&&!cf.speedBoost.taken&&(
              <View style={{
                position:'absolute',
                left:(cf.speedBoost.x-16)*ZOOM,top:(cf.speedBoost.y-16)*ZOOM,
                width:32*ZOOM,height:32*ZOOM,borderRadius:8,
                backgroundColor:nearSpeed?'#ffee44':'#886600aa',
                borderWidth:1.5,borderColor:'#ffcc00',
                justifyContent:'center',alignItems:'center',
              }}>
                <Text style={{fontSize:16*ZOOM}}>⚡</Text>
                {nearSpeed&&<View style={{position:'absolute',bottom:-14*ZOOM,alignSelf:'center',backgroundColor:'#886600',paddingHorizontal:4,paddingVertical:1,borderRadius:3}}>
                  <Text style={{color:'white',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>HOLD</Text>
                </View>}
              </View>
            )}

            {/* ── SHIELD POWER ───────────────────────────────────────────── */}
            {cf.shieldPower&&!cf.shieldPower.taken&&(
              <View style={{
                position:'absolute',
                left:(cf.shieldPower.x-16)*ZOOM,top:(cf.shieldPower.y-16)*ZOOM,
                width:32*ZOOM,height:32*ZOOM,borderRadius:8,
                backgroundColor:nearShield?'rgba(80,170,255,0.9)':'rgba(80,170,255,0.35)',
                borderWidth:2,borderColor:'rgba(255,255,255,0.25)',
                justifyContent:'center',alignItems:'center',
                shadowColor:'#66bbff',shadowRadius:nearShield?10*ZOOM:4*ZOOM,shadowOpacity:0.7,
              }}>
                <Text style={{fontSize:16*ZOOM}}>🛡</Text>
                {nearShield&&<View style={{position:'absolute',bottom:-14*ZOOM,alignSelf:'center',backgroundColor:'rgba(30,90,140,0.95)',paddingHorizontal:4,paddingVertical:1,borderRadius:3}}>
                  <Text style={{color:'#ccf0ff',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>HOLD</Text>
                </View>}
              </View>
            )}

            {/* ── PUSH CHARGE PICKUPS ─────────────────────────────────────── */}
            {cf.pushPickups&&cf.pushPickups.map((pp,i)=>{
              if(pp.taken)return null;
              const nearPP=dist(player.x,player.y,pp.x,pp.y)<55;
              return(
                <View key={`push${i}`} style={{
                  position:'absolute',
                  left:(pp.x-22)*ZOOM,top:(pp.y-22)*ZOOM,
                  width:44*ZOOM,height:44*ZOOM,borderRadius:8*ZOOM,
                  backgroundColor:nearPP?'rgba(255,100,40,0.25)':'rgba(200,60,10,0.12)',
                  borderWidth:nearPP?2.5:1.5,borderColor:nearPP?'#ff7744':'#cc4422',
                  justifyContent:'center',alignItems:'center',
                  shadowColor:'#ff5500',shadowRadius:nearPP?14*ZOOM:6*ZOOM,shadowOpacity:0.9,
                }}>
                  <Text style={{fontSize:22*ZOOM}}>💥</Text>
                  {nearPP&&<View style={{position:'absolute',bottom:-16*ZOOM,alignSelf:'center',
                    backgroundColor:'rgba(120,30,0,0.9)',paddingHorizontal:5,paddingVertical:1,borderRadius:4}}>
                    <Text style={{color:'#ffbb88',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>WALK</Text>
                  </View>}
                </View>
              );
            })}

            {/* M4.2: COIN PICKUPS — glowing gold dots scattered across the maze floor */}
            {cf.coinPickups&&cf.coinPickups.filter(cp=>!cp.taken).map((cp,i)=>{
              const nearCoin=dist(player.x,player.y,cp.x,cp.y)<55;
              return(
                <View key={`coin${i}`} style={{
                  position:'absolute',
                  left:(cp.x-12)*ZOOM,top:(cp.y-12)*ZOOM,
                  width:24*ZOOM,height:24*ZOOM,borderRadius:12*ZOOM,
                  backgroundColor:nearCoin?'rgba(201,164,76,0.45)':'rgba(201,164,76,0.18)',
                  borderWidth:nearCoin?2:1.5,borderColor:nearCoin?'#f0c850':'rgba(201,164,76,0.7)',
                  justifyContent:'center',alignItems:'center',
                  shadowColor:'#c9a44c',shadowRadius:nearCoin?10*ZOOM:4*ZOOM,shadowOpacity:nearCoin?1:0.6,
                }}>
                  <Text style={{fontSize:12*ZOOM}}>🪙</Text>
                </View>
              );
            })}
            {cf.escapeDoor&&(
              <View style={{
                position:'absolute',
                left:cf.escapeDoor.x*ZOOM,
                top:cf.escapeDoor.y*ZOOM,
                width:cf.escapeDoor.w*ZOOM,
                height:cf.escapeDoor.h*ZOOM,
                backgroundColor:nearDoor?'rgba(180,120,60,0.55)':'rgba(120,60,20,0.65)',
                borderWidth:2,
                borderColor:nearDoor?'rgba(255,240,200,0.55)':'rgba(255,220,160,0.35)',
                borderRadius:10,
              }}>
                {nearDoor&&(
                  <View style={{position:'absolute',left:0,right:0,bottom:-16*ZOOM,alignItems:'center'}}>
                    <View style={{backgroundColor:'rgba(60,30,10,0.9)',paddingHorizontal:6,paddingVertical:2,borderRadius:6}}>
                      <Text style={{color:'rgba(255,240,200,0.9)',fontWeight:'900',fontSize:7*ZOOM,fontFamily:'monospace'}}>
                        {allKeys?'OPEN':'LOCKED'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── GHOSTS ───────────────────────────────────────────────────── */}
            {visibleEnemies.map((e,i)=>(
              <View key={`e${i}`} style={{
                position:'absolute',
                left:(e.x-ENEMY_R*3.25)*ZOOM,
                top:(e.y-ENEMY_R*3.25)*ZOOM,
              }}>
                <GhostSprite state={e.state} kind={e.kind} zoom={ZOOM} isFrozen={e.frozenUntil>Date.now()}/>
              </View>
            ))}

            {/* ── PLAYER ───────────────────────────────────────────────────── */}
            <View style={{
              position:'absolute',
              left:(pl.x-50)*ZOOM,
              top:(pl.y-80)*ZOOM,
            }}>
              <ChibiCharacter charData={charData} size={ZOOM*1.8} flip={playerFacingLeft}/>
            </View>

            {/* ── DARKNESS / FOG-OF-WAR (hidden during preview AND player freeze) ─────────── */}
            {!preview&&!freezeActive&&(
            <View style={{position:'absolute',left:0,top:0,width:WORLD_W*ZOOM,height:WORLD_H*ZOOM}} pointerEvents="none">
              <Svg width={WORLD_W*ZOOM} height={WORLD_H*ZOOM}>
                <Defs>
                  <Mask id="vmask">
                    <Rect x="0" y="0" width="100%" height="100%" fill="white"/>
                    {/* Dark mode: tighter vision circle (110 units); normal: full VISION_RADIUS */}
                    <Circle cx={pl.x*ZOOM} cy={pl.y*ZOOM}
                      r={(darkMic.phase==='active' ? 120 : VISION_RADIUS)*ZOOM}
                      fill="black"/>
                  </Mask>
                </Defs>
                {/* Dark mode: lighter dim (rest of screen visible but dark); normal: full vignette */}
                <Rect x="0" y="0" width="100%" height="100%"
                  fill={darkMic.phase==='active' ? 'rgba(0,0,0,0.58)' : theme.vignette}
                  mask="url(#vmask)"/>
              </Svg>
            </View>
            )}

            {/* ── CHASE TINT ───────────────────────────────────────────────── */}
            {anyChasing&&(
              <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width:WORLD_W*ZOOM,height:WORLD_H*ZOOM,backgroundColor:'rgba(255,0,30,0.07)'}}/>
            )}
            {panic.active&&(
              <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width:WORLD_W*ZOOM,height:WORLD_H*ZOOM,backgroundColor:'rgba(255,0,60,0.06)'}}/>
            )}

            {/* ── FREEZE ACTIVE — bright icy tint (lights on!) ───────────── */}
            {freezeActive&&(
              <View pointerEvents="none" style={{position:'absolute',left:0,top:0,width:WORLD_W*ZOOM,height:WORLD_H*ZOOM,backgroundColor:'rgba(180,240,255,0.10)'}}/>
            )}
          </View>
        </Animated.View>
      </View>

      {/* FREEZE ACTIVE OVERLAY — icy countdown in bottom-left corner */}
      {freezeActive&&(
        <View pointerEvents="none" style={{
          position:'absolute',left:0,right:0,
          top:HUD_H, height:viewH,
        }}>
          {/* Icy border glow around the whole screen */}
          <View style={{position:'absolute',inset:0,borderWidth:3,borderColor:'rgba(100,220,255,0.35)',pointerEvents:'none'}}/>
          {/* Freeze countdown in bottom-left corner */}
          <View style={{position:'absolute',bottom:14,left:14}}>
            <View style={{
              backgroundColor:'rgba(0,20,40,0.88)',
              borderWidth:1.5,borderColor:'#55ccff',
              borderRadius:12,paddingHorizontal:12,paddingVertical:8,
              flexDirection:'row',alignItems:'center',gap:8,
            }}>
              <Text style={{color:'rgba(160,230,255,0.8)',fontFamily:'monospace',fontSize:9,letterSpacing:2}}>
                ❄ FREEZE ENDS IN
              </Text>
              <Text style={{color:'#88eeff',fontFamily:'monospace',fontWeight:'900',fontSize:24,lineHeight:26}}>
                {Math.max(0,Math.ceil((frozenUntil-Date.now())/1000))}
              </Text>
              <Text style={{color:'rgba(160,230,255,0.6)',fontFamily:'monospace',fontSize:8}}>s</Text>
            </View>
          </View>
          {/* Center label */}
          <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,justifyContent:'center',alignItems:'center',pointerEvents:'none'}}>
            <Text style={{color:'rgba(100,220,255,0.18)',fontFamily:'monospace',fontWeight:'900',fontSize:9,letterSpacing:4}}>
              GHOSTS FROZEN — MOVE FREELY
            </Text>
          </View>
        </View>
      )}

      {/* FLOOR LABEL — always floats at top-center of maze */}
      {!preview&&(
        <View pointerEvents="none" style={{
          position:'absolute', left:0, right:0, top:HUD_H+8,
          alignItems:'center',
        }}>
          <View style={{
            backgroundColor:'rgba(0,0,0,0.70)',borderRadius:8,
            paddingHorizontal:16,paddingVertical:5,
            borderWidth:1,borderColor:theme.accent+'55',
          }}>
            <Text style={{color:theme.accent,fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:3,textAlign:'center'}}>
              FLOOR {floorIndex+1} — {theme.title}
            </Text>
          </View>
        </View>
      )}

      {/* PREVIEW COUNTDOWN OVERLAY — only shown while preview===true */}
      {preview&&previewSec>0&&(
        <View pointerEvents="none" style={{
          position:'absolute',left:0,right:0,
          top:HUD_H, height:viewH,
        }}>
          {/* Semi-transparent frosted overlay — maze visible underneath */}
          <View style={{position:'absolute',inset:0,backgroundColor:'rgba(10,8,28,0.52)'}}/>
          {/* Subtle top-edge glow */}
          <View style={{position:'absolute',top:0,left:0,right:0,height:2,backgroundColor:theme.accent,opacity:0.5}}/>
          {/* Floor title + difficulty centered */}
          <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,justifyContent:'center',alignItems:'center',gap:10}}>
            <View style={{backgroundColor:'rgba(0,0,0,0.70)',borderRadius:10,paddingHorizontal:20,paddingVertical:8,borderWidth:1,borderColor:theme.accent+'66'}}>
              <Text style={{color:theme.accent,fontFamily:'monospace',fontWeight:'900',fontSize:13,letterSpacing:3,textAlign:'center'}}>
                FLOOR {floorIndex+1} — {theme.title}
              </Text>
            </View>
            <Text style={{color:'rgba(255,255,255,0.30)',fontFamily:'monospace',fontWeight:'900',fontSize:9,letterSpacing:4,marginTop:4}}>
              MEMORIZE THE MAZE
            </Text>
          </View>
          {/* Countdown in bottom-left corner */}
          <View style={{position:'absolute',bottom:14,left:14}}>
            <View style={{
              backgroundColor:'rgba(0,0,0,0.80)',
              borderWidth:1.5,borderColor:previewSec<=5?'#ff4444':theme.accent,
              borderRadius:12,paddingHorizontal:12,paddingVertical:8,
              flexDirection:'row',alignItems:'center',gap:8,
            }}>
              <Text style={{color:previewSec<=5?'#ff6666':'rgba(255,255,255,0.55)',fontFamily:'monospace',fontSize:9,letterSpacing:2}}>
                ⏱ LIGHTS OFF IN
              </Text>
              <Text style={{color:previewSec<=5?'#ff4444':theme.accent,fontFamily:'monospace',fontWeight:'900',fontSize:24,lineHeight:26}}>
                {previewSec}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* HINT — floating overlay at bottom of viewport */}
      <View pointerEvents="none" style={{
        position:'absolute', left:0, right:0,
        top:HUD_H + viewH - HINT_H,
        height:HINT_H, justifyContent:'center', paddingHorizontal:12,
        backgroundColor:anyChasing?'rgba(90,0,15,0.88)':anyAlert?'rgba(70,45,0,0.80)':'rgba(0,0,0,0.65)',
        borderTopWidth:1,borderTopColor:anyChasing?theme.chaseColor+'66':theme.edge+'33',
      }}>
        <Text style={{fontSize:11,fontFamily:'monospace',letterSpacing:0.3,
          color:anyChasing?'#ffbbbb':anyAlert?'#ffeebb':'rgba(255,255,255,0.80)'}}
          numberOfLines={1}>{hintText}</Text>
      </View>

      {/* CONTROLS — single horizontal row: D-pad left, action buttons right */}
      <View style={{
        height:CONTROLS_H,
        paddingBottom:SAFE_BOT, paddingTop:7, paddingHorizontal:10,
        flexDirection:'row', alignItems:'center', gap:6,
        backgroundColor:theme.bg2, borderTopWidth:1, borderTopColor:theme.edge+'55',
      }}>

        {/* D-PAD — compact 3-button inline: ← ↑↓ → */}
        <View style={{flexDirection:'row', alignItems:'center', gap:3, flexShrink:0}}>
          {/* LEFT */}
          <TouchableOpacity disabled={elevatorBusy||pauseOpen}
            pressRetentionOffset={{top:20,left:20,bottom:20,right:20}}
            style={{width:ACT_H,height:ACT_H,borderRadius:8,
              backgroundColor:theme.edge+'22',borderWidth:1.5,borderColor:theme.edge+'88',
              alignItems:'center',justifyContent:'center',opacity:elevatorBusy?0.3:1}}
            onPressIn={()=>{moveRef.current.left=true;registerTap('left');}} onPressOut={()=>moveRef.current.left=false}>
            <Text style={{color:'white',fontWeight:'900',fontSize:14}}>←</Text>
          </TouchableOpacity>

          {/* UP + DOWN stacked */}
          <View style={{gap:3}}>
            <TouchableOpacity disabled={elevatorBusy||pauseOpen}
              pressRetentionOffset={{top:20,left:20,bottom:20,right:20}}
              style={{width:ACT_H,height:Math.round(ACT_H*0.48),borderRadius:6,
                backgroundColor:theme.edge+'22',borderWidth:1.5,borderColor:theme.edge+'88',
                alignItems:'center',justifyContent:'center',opacity:elevatorBusy?0.3:1}}
              onPressIn={()=>{moveRef.current.up=true;registerTap('up');}} onPressOut={()=>moveRef.current.up=false}>
              <Text style={{color:'white',fontWeight:'900',fontSize:11}}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={elevatorBusy||pauseOpen}
              pressRetentionOffset={{top:20,left:20,bottom:20,right:20}}
              style={{width:ACT_H,height:Math.round(ACT_H*0.48),borderRadius:6,
                backgroundColor:theme.edge+'22',borderWidth:1.5,borderColor:theme.edge+'88',
                alignItems:'center',justifyContent:'center',opacity:elevatorBusy?0.3:1}}
              onPressIn={()=>{moveRef.current.down=true;registerTap('down');}} onPressOut={()=>moveRef.current.down=false}>
              <Text style={{color:'white',fontWeight:'900',fontSize:11}}>↓</Text>
            </TouchableOpacity>
          </View>

          {/* RIGHT */}
          <TouchableOpacity disabled={elevatorBusy||pauseOpen}
            pressRetentionOffset={{top:20,left:20,bottom:20,right:20}}
            style={{width:ACT_H,height:ACT_H,borderRadius:8,
              backgroundColor:theme.edge+'22',borderWidth:1.5,borderColor:theme.edge+'88',
              alignItems:'center',justifyContent:'center',opacity:elevatorBusy?0.3:1}}
            onPressIn={()=>{moveRef.current.right=true;registerTap('right');}} onPressOut={()=>moveRef.current.right=false}>
            <Text style={{color:'white',fontWeight:'900',fontSize:14}}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Thin divider */}
        <View style={{width:1,height:ACT_H*0.7,backgroundColor:theme.edge+'44'}}/>

        {/* ACTION BUTTONS — all in one horizontal row, flex to fill remaining space */}
        <View style={{flex:1, flexDirection:'row', gap:4, alignItems:'center'}}>

          {/* FREEZE */}
          <TouchableOpacity
            disabled={pauseOpen||elevatorBusy||freezeActive}
            style={{flex:1, height:ACT_H, borderRadius:8,
              backgroundColor:inv.freezeCharges>0&&!freezeActive?'rgba(80,210,255,0.18)':freezeActive?'rgba(80,210,255,0.10)':'rgba(80,210,255,0.04)',
              borderWidth:1.5, borderColor:inv.freezeCharges>0&&!freezeActive?'#66ccff':freezeActive?'rgba(100,200,255,0.55)':'rgba(100,180,220,0.18)',
              alignItems:'center', justifyContent:'center',
              opacity:(!pauseOpen&&!elevatorBusy&&!freezeActive)?1:0.40}}
            onPress={activateFreeze}>
            <Text style={{color:inv.freezeCharges>0&&!freezeActive?'#88ddff':freezeActive?'#55ccff':'rgba(100,180,220,0.38)',
              fontWeight:'900', fontSize:9, fontFamily:'monospace'}}>
              ❄️{inv.freezeCharges}{freezeActive?'▶':''}
            </Text>
          </TouchableOpacity>

          {/* PUSH */}
          <TouchableOpacity
            disabled={pauseOpen||elevatorBusy||freezeActive}
            style={{flex:1, height:ACT_H, borderRadius:8,
              backgroundColor:ghostIsClose&&inv.pushCharges>0?'rgba(255,80,30,0.26)':'rgba(255,80,30,0.05)',
              borderWidth:1.5, borderColor:ghostIsClose&&inv.pushCharges>0?'#ff6633':'rgba(255,100,50,0.18)',
              alignItems:'center', justifyContent:'center',
              opacity:(!pauseOpen&&!elevatorBusy&&!freezeActive)?1:0.35}}
            onPress={pushGhost}>
            <Text style={{color:ghostIsClose&&inv.pushCharges>0?'#ff8855':'rgba(255,120,80,0.35)',
              fontWeight:'900', fontSize:9, fontFamily:'monospace'}}>
              💥{inv.pushCharges}
            </Text>
          </TouchableOpacity>

          {/* SHIELD */}
          <TouchableOpacity
            disabled={inv.shieldCharges<=0||pauseOpen}
            style={{flex:1, height:ACT_H, borderRadius:8,
              backgroundColor:inv.shieldArmed?theme.accent+'22':'transparent',
              borderWidth:1.5, borderColor:inv.shieldCharges>0?theme.accent:theme.edge+'33',
              alignItems:'center', justifyContent:'center',
              opacity:(inv.shieldCharges>0&&!pauseOpen)?1:0.35}}
            onPress={toggleShield}>
            <Text style={{color:inv.shieldCharges>0?theme.accent:'rgba(255,255,255,0.25)',
              fontWeight:'900', fontSize:9, fontFamily:'monospace'}}>
              🛡{inv.shieldCharges}{inv.shieldArmed?'✓':''}
            </Text>
          </TouchableOpacity>

          {/* CAPTURE/KEY */}
          <TouchableOpacity
            disabled={!canCapture||pauseOpen||elevatorBusy}
            style={{flex:1.3, height:ACT_H, borderRadius:8,
              backgroundColor:canCapture?theme.edge+'18':'transparent',
              borderWidth:1.5, borderColor:canCapture?theme.edge+'bb':theme.edge+'33',
              alignItems:'center', justifyContent:'center',
              opacity:(canCapture&&!pauseOpen&&!elevatorBusy)?1:0.32}}
            onPressIn={()=>onCaptureDown(null)} onPressOut={onCaptureUp}>
            <Text style={{color:canCapture?'white':'rgba(255,255,255,0.30)',
              fontWeight:'900', fontSize:8, fontFamily:'monospace'}} numberOfLines={1}>
              {captureLabel}
            </Text>
          </TouchableOpacity>

          {/* LIFT / OPEN */}
          <TouchableOpacity
            disabled={!inElevator||elevatorBusy||pauseOpen||panic.active}
            style={{flex:1.2, height:ACT_H, borderRadius:8,
              backgroundColor:inElevator&&allKeys?'rgba(80,220,140,0.22)':inElevator?'rgba(140,120,255,0.22)':'transparent',
              borderWidth:1.5,
              borderColor:inElevator&&allKeys?'rgba(80,220,140,0.85)':inElevator?'rgba(180,160,255,0.85)':theme.edge+'33',
              alignItems:'center', justifyContent:'center',
              opacity:(inElevator&&!elevatorBusy&&!pauseOpen&&!panic.active)?1:0.35}}
            onPress={elevatorSequence}>
            <Text style={{
              color:inElevator&&allKeys?'#80ffb0':inElevator?'#d6c8ff':'rgba(255,255,255,0.28)',
              fontWeight:'900', fontSize:9, fontFamily:'monospace'}} numberOfLines={1}>
              {inElevator&&allKeys?'🚪OPEN':'🛗LIFT'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* SILENCE ALARM — shown at game start */}
      <Modal visible={silenceAlarm} transparent animationType="fade">
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.88)',justifyContent:'center',alignItems:'center',padding:32}}>
          <View style={{
            borderRadius:20,borderWidth:2,borderColor:'rgba(255,60,60,0.7)',
            backgroundColor:'#0d0005',padding:28,maxWidth:360,width:'100%',alignItems:'center',gap:14,
          }}>
            <Text style={{color:'#ff6666',fontFamily:'monospace',fontWeight:'900',fontSize:18,letterSpacing:4,textAlign:'center'}}>
              STAY SILENT
            </Text>
            <View style={{height:1.5,width:80,backgroundColor:'rgba(255,80,80,0.5)',borderRadius:1}}/>
            <Text style={{color:'rgba(255,200,200,0.80)',fontFamily:'monospace',fontSize:11,lineHeight:19,textAlign:'center'}}>
              {'During Dark Mode, the microphone is active.\n\nIf you scream, shout, or make ANY loud noise — nearby ghosts will hear you and rush directly to your location.\n\nKeep your voice down to survive.'}
            </Text>
            <TouchableOpacity
              onPress={()=>setSilenceAlarm(false)}
              activeOpacity={0.85}
              style={{
                marginTop:8,paddingHorizontal:32,paddingVertical:14,borderRadius:14,
                backgroundColor:'rgba(255,40,40,0.18)',borderWidth:2,borderColor:'rgba(255,80,80,0.7)',
                alignItems:'center',width:'100%',
              }}>
              <Text style={{color:'#ff8888',fontFamily:'monospace',fontWeight:'900',fontSize:13,letterSpacing:3}}>
                I UNDERSTAND — BEGIN
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PauseModal
        visible={pauseOpen}
        onExit={()=>{
          // hard exit: go back to hub, reset pause and movement (progress not saved by design)
          setPauseOpen(false);setPaused(false);
          moveRef.current={up:false,down:false,left:false,right:false};
          setScreen('hub');
        }}
        onContinue={closePause}
        keysCount={keysTaken.filter(Boolean).length}
        floorNum={floorIndex+1}
        elapsedMs={runStartRef.current?Date.now()-runStartRef.current:0}
        pushCharges={inv.pushCharges}
        shieldCharges={inv.shieldCharges}
        shieldArmed={inv.shieldArmed}
      />

<CaptureOverlay
        visible={captureUI.visible}
        title={
          captureUI.type==='KEY'?'CAPTURING KEY'
          :captureUI.type==='BANDAGE'?'CAPTURING BANDAGE'
          :captureUI.type==='SHIELD'?'🛡 CAPTURING SHIELD'
          :captureUI.type==='SPEED'?'⚡ CAPTURING SPEED'
          :captureUI.type==='KILL'?'💀 KILL ORB'
          :'CAPTURE'
        }
        progress01={captureUI.progress01}
        accent={theme.accent}
      />
      <ElevatorRideOverlay visible={elevatorRide.visible} fromFloor={elevatorRide.fromFloor??0} toFloor={elevatorRide.toFloor??1} charData={charData}/>
    </View>
  );
}
const SS=StyleSheet.create({
  full:         {flex:1},
  hud:          {paddingHorizontal:14,paddingTop:8,paddingBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  hudTitle:     {color:'white',fontSize:13,fontWeight:'900',fontFamily:'monospace',letterSpacing:2},
  hudSub:       {color:'rgba(255,255,255,0.45)',fontSize:10,fontFamily:'monospace',letterSpacing:1},
  hudTiny:      {color:'rgba(255,255,255,0.45)',fontSize:9,fontFamily:'monospace'},
  panicText:    {color:'rgba(255,160,180,0.95)',fontSize:10,fontWeight:'900',fontFamily:'monospace'},
  viewport:     {width:'100%',overflow:'hidden',borderTopWidth:1,borderBottomWidth:1},
  hintBox:      {paddingHorizontal:14,paddingVertical:5,justifyContent:'center'},
  hintText:     {fontSize:10,fontFamily:'monospace'},
  controls:     {paddingHorizontal:14,paddingTop:6,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  dirPad:       {gap:5,alignItems:'center'},
  btn:          {width:50,height:38,borderRadius:10,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1,alignItems:'center',justifyContent:'center'},
  btnBig:       {paddingHorizontal:14,height:38,borderRadius:10,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:1.5,alignItems:'center',justifyContent:'center'},
  btnTxt:       {color:'white',fontWeight:'900',fontSize:12,fontFamily:'monospace',letterSpacing:1},
  captureWrap:  {position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'center',alignItems:'center'},
  captureCard:  {width:220,paddingVertical:16,paddingHorizontal:14,borderRadius:18,backgroundColor:'rgba(0,0,0,0.78)',borderWidth:1,borderColor:'rgba(255,255,255,0.12)',alignItems:'center'},
  captureTitle: {color:'white',fontWeight:'900',fontSize:13,fontFamily:'monospace',letterSpacing:1},
  capturePct:   {color:'white',fontWeight:'900',fontSize:16},
  captureSub:   {color:'rgba(255,255,255,0.6)',marginTop:2,fontSize:11},
  doorsWrap:    {position:'absolute',left:0,right:0,top:0,bottom:0,justifyContent:'center',alignItems:'center'},
  doorPanel:    {position:'absolute',top:0,bottom:0,width:'52%',backgroundColor:'#08070f',borderColor:'rgba(140,120,220,0.15)',borderWidth:1},
  doorLeft:     {left:0},
  doorRight:    {right:0},
  doorShade:    {position:'absolute',left:0,right:0,top:0,bottom:0,backgroundColor:'#020108'},
  doorLabelWrap:{position:'absolute',top:72,alignSelf:'center',paddingHorizontal:18,paddingVertical:10,borderRadius:12,backgroundColor:'rgba(8,6,20,0.88)',borderWidth:1,borderColor:'rgba(180,160,255,0.2)'},
  doorLabel:    {color:'rgba(200,190,255,0.85)',fontWeight:'900',fontFamily:'monospace',letterSpacing:4,fontSize:11},
});

const navRef = createNavigationContainerRef();
// Stack is declared near App() below alongside Tab navigator (M3.3)

function msToClock(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const mm = Math.floor(s/60);
  const ss = s%60;
  return `${mm}:${ss.toString().padStart(2,'0')}`;
}

function ResultsScreen({ route, navigation }){
  const { outcome='dead', durMs=0, bestEscapeMs=0, brokeRecord=false } = route?.params ?? {};
  const isWin = outcome==='win';
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    Animated.timing(fade,{toValue:1,duration:600,useNativeDriver:true}).start();
  },[]);
  return (
    <View style={{flex:1,backgroundColor:isWin?'#020b06':'#060004'}}>
      <StatusBar hidden/>
      <Animated.View style={{flex:1,opacity:fade,justifyContent:'center',alignItems:'center',padding:24}}>
        <View style={{width:'100%',maxWidth:380,borderRadius:20,
          borderWidth:1.5,borderColor:isWin?'rgba(94,207,160,0.25)':'rgba(200,20,40,0.25)',
          backgroundColor:isWin?'rgba(94,207,160,0.05)':'rgba(200,20,40,0.05)',
          padding:24,gap:0}}>

          <Text style={{color:isWin?'rgba(94,207,160,0.6)':'rgba(200,20,40,0.6)',fontFamily:'monospace',fontSize:9,letterSpacing:5,marginBottom:10}}>
            {isWin?'MISSION COMPLETE':'MISSION FAILED'}
          </Text>
          <Text style={{color:isWin?'#5ecfa0':'#cc2233',fontFamily:'monospace',fontWeight:'900',fontSize:36,letterSpacing:4,marginBottom:4}}>
            {isWin?'ESCAPED':'DEFEATED'}
          </Text>
          <Text style={{color:'rgba(255,255,255,0.4)',fontFamily:'monospace',fontSize:10,letterSpacing:2,marginBottom:20}}>
            {isWin?'All 4 floors conquered. You survived.':'The ghost got you. Better luck next time.'}
          </Text>

          <View style={{height:1,backgroundColor:'rgba(255,255,255,0.06)',marginBottom:18}}/>

          <View style={{flexDirection:'row',gap:12,marginBottom:20}}>
            <View style={{flex:1,padding:14,borderRadius:12,backgroundColor:'rgba(255,255,255,0.03)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)',alignItems:'center',gap:4}}>
              <Text style={{color:'rgba(255,255,255,0.28)',fontFamily:'monospace',fontSize:8,letterSpacing:2}}>TIME</Text>
              <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',fontSize:20}}>{msToClock(durMs)}</Text>
            </View>
            {isWin&&(
              <View style={{flex:1,padding:14,borderRadius:12,backgroundColor:'rgba(201,164,76,0.06)',borderWidth:1,borderColor:'rgba(201,164,76,0.2)',alignItems:'center',gap:4}}>
                <Text style={{color:'rgba(201,164,76,0.6)',fontFamily:'monospace',fontSize:8,letterSpacing:2}}>BEST</Text>
                <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:20}}>{bestEscapeMs?msToClock(bestEscapeMs):'--'}</Text>
              </View>
            )}
          </View>

          {brokeRecord&&(
            <View style={{padding:12,borderRadius:10,backgroundColor:'rgba(201,164,76,0.1)',borderWidth:1,borderColor:'rgba(201,164,76,0.3)',alignItems:'center',marginBottom:16}}>
              <Text style={{color:'#c9a44c',fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:3}}>★ NEW RECORD!</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={()=>navigation.replace('Game')}
            activeOpacity={0.88}
            style={{paddingVertical:14,borderRadius:12,borderWidth:1.5,
              borderColor:'rgba(255,255,255,0.18)',backgroundColor:'rgba(255,255,255,0.04)',alignItems:'center'}}>
            <Text style={{color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontWeight:'900',letterSpacing:3,fontSize:12}}>
              BACK TO MENU
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

function AchievementsScreen({ navigation }){
  const [stats, setStats] = useState({ totalPlayMs:0, bestEscapeMs:0, escapes:0, deaths:0, totalRuns:0 });
  const [last,  setLast]  = useState(null);
  const [location, setLocation] = useState(null); // {city, country, lat, lon}
  const [locStatus, setLocStatus] = useState('idle'); // idle | loading | granted | denied
  const Location = (() => { try { return require('expo-location'); } catch { return null; } })();

  useEffect(()=>{
    let alive = true;
    (async()=>{
      try{
        const raw = await storage.get(STATS_KEY);
        if(raw && alive){ const j=JSON.parse(raw); if(j) setStats(s=>({...s,...j})); }
      }catch(e){}
      try{
        const lr = await storage.get(LASTRESULT_KEY);
        if(lr && alive) setLast(JSON.parse(lr));
      }catch(e){}
      // Load saved location
      try{
        const sl = await storage.get('LASTFLOOR_LOCATION_V1');
        if(sl && alive) setLocation(JSON.parse(sl));
      }catch(e){}
    })();
    return()=>{ alive=false; };
  },[]);

  const requestLocation = async()=>{
    if(!Location){ setLocStatus('denied'); return; }
    setLocStatus('loading');
    try{
      const { status } = await Location.requestForegroundPermissionsAsync();
      if(status !== 'granted'){ setLocStatus('denied'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const loc = {
        city:    geo?.city || geo?.district || geo?.subregion || 'Unknown City',
        country: geo?.country || 'Unknown',
        lat:     pos.coords.latitude.toFixed(2),
        lon:     pos.coords.longitude.toFixed(2),
      };
      setLocation(loc);
      setLocStatus('granted');
      await storage.set('LASTFLOOR_LOCATION_V1', JSON.stringify(loc));
    }catch(e){ setLocStatus('denied'); }
  };

  const winRate = stats.totalRuns > 0 ? Math.round((stats.escapes / stats.totalRuns) * 100) : 0;
  const playHours = ((stats.totalPlayMs || 0) / 3600000).toFixed(1);

  // ── BADGE DEFINITIONS ────────────────────────────────────────────────────
  const badges = [
    { id:'first_escape', sym:'★', color:'#c9a44c', label:'First Escape',    desc:'Escape the building once',          unlocked: stats.escapes >= 1 },
    { id:'survivor_3',   sym:'3', color:'#5ecfa0', label:'Triple Survivor', desc:'Escape 3 times',                    unlocked: stats.escapes >= 3 },
    { id:'survivor_10',  sym:'X', color:'#a090ff', label:'Veteran',         desc:'Escape 10 times',                   unlocked: stats.escapes >= 10 },
    { id:'speed_run',    sym:'<', color:'#88ddff', label:'Speed Runner',    desc:'Escape in under 3 minutes',         unlocked: stats.bestEscapeMs > 0 && stats.bestEscapeMs < 180000 },
    { id:'ghost_magnet', sym:'!', color:'#ff6644', label:'Ghost Magnet',    desc:'Die 5 times (you tried)',           unlocked: stats.deaths >= 5 },
    { id:'time_lord',    sym:'H', color:'#ffcc44', label:'Time Lord',       desc:'Play for over 1 hour total',        unlocked: (stats.totalPlayMs||0) >= 3600000 },
    { id:'explorer',     sym:'↑', color:'#4488ff', label:'Floor Climber',   desc:'Complete 20 runs total',            unlocked: (stats.totalRuns||0) >= 20 },
    { id:'location',     sym:'⊕', color:'#44ffaa', label:'Marked Territory', desc:'Set your survivor home base',     unlocked: !!location },
  ];

  const StatBox = ({label, value, color='#e8dcc8'})=>(
    <View style={{flex:1,padding:14,borderRadius:14,backgroundColor:'rgba(255,255,255,0.03)',
      borderWidth:1,borderColor:'rgba(255,255,255,0.08)',alignItems:'center',gap:4}}>
      <Text style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:8,letterSpacing:2}}>{label}</Text>
      <Text style={{color,fontFamily:'monospace',fontWeight:'900',fontSize:18,lineHeight:22}}>{value}</Text>
    </View>
  );

  return(
    <View style={{flex:1,backgroundColor:'#050508'}}>
      <ScrollView contentContainerStyle={{padding:18,paddingBottom:40}} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <View>
            <Text style={{color:'rgba(255,255,255,0.25)',fontFamily:'monospace',fontSize:8,letterSpacing:5,marginBottom:4}}>THE LAST FLOOR</Text>
            <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',fontSize:18,letterSpacing:5}}>ACHIEVEMENTS</Text>
          </View>
          <TouchableOpacity onPress={()=>{
            try{ navRef.current?.goBack(); }
            catch(e){ try{ navigation.goBack(); }catch(ee){} }
          }} activeOpacity={0.8}
            style={{paddingHorizontal:14,paddingVertical:10,borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,0.14)',backgroundColor:'rgba(255,255,255,0.03)'}}>
            <Text style={{color:'rgba(255,255,255,0.6)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>BACK</Text>
          </TouchableOpacity>
        </View>

        {/* ── STATS GRID ── */}
        <Text style={{color:'rgba(201,164,76,0.7)',fontFamily:'monospace',fontSize:8,letterSpacing:4,marginBottom:8}}>YOUR STATS</Text>
        <View style={{flexDirection:'row',gap:8,marginBottom:8}}>
          <StatBox label="ESCAPES"  value={stats.escapes||0}   color='#c9a44c'/>
          <StatBox label="DEATHS"   value={stats.deaths||0}    color='#ff5566'/>
          <StatBox label="WIN RATE" value={`${winRate}%`}      color='#5ecfa0'/>
        </View>
        <View style={{flexDirection:'row',gap:8,marginBottom:20}}>
          <StatBox label="BEST TIME" value={stats.bestEscapeMs?msToClock(stats.bestEscapeMs):'--'} color='#88ddff'/>
          <StatBox label="TOTAL RUNS" value={stats.totalRuns||stats.escapes+stats.deaths||0} color='#d6c8ff'/>
          <StatBox label="HOURS" value={playHours} color='#ffcc44'/>
        </View>

        {/* ── LAST RUN ── */}
        {last&&(
          <View style={{padding:16,borderRadius:14,backgroundColor:'rgba(255,255,255,0.025)',
            borderWidth:1,borderColor:'rgba(255,255,255,0.07)',marginBottom:20}}>
            <Text style={{color:'rgba(255,255,255,0.28)',fontFamily:'monospace',fontSize:8,letterSpacing:4,marginBottom:8}}>LAST RUN</Text>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={{width:8,height:8,borderRadius:4,
                  backgroundColor:last.outcome==='win'?'#5ecfa0':'#cc2233'}}/>
                <Text style={{color:last.outcome==='win'?'#5ecfa0':'#ff4455',
                  fontFamily:'monospace',fontWeight:'900',fontSize:13,letterSpacing:2}}>
                  {last.outcome==='win'?'ESCAPED':'DEFEATED'}
                </Text>
              </View>
              <Text style={{color:'rgba(255,255,255,0.55)',fontFamily:'monospace',fontSize:13,fontWeight:'900'}}>
                {msToClock(last.durMs||0)}
              </Text>
            </View>
          </View>
        )}

        {/* ── LOCATION CARD ── */}
        <Text style={{color:'rgba(201,164,76,0.7)',fontFamily:'monospace',fontSize:8,letterSpacing:4,marginBottom:8}}>SURVIVOR HOME BASE</Text>
        <View style={{padding:18,borderRadius:16,backgroundColor:'rgba(68,255,170,0.04)',
          borderWidth:1.5,borderColor: location?'rgba(68,255,170,0.3)':'rgba(255,255,255,0.08)',marginBottom:20}}>
          {location ? (
            <View style={{gap:8}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={{width:36,height:36,borderRadius:10,backgroundColor:'rgba(68,255,170,0.12)',
                  borderWidth:1,borderColor:'rgba(68,255,170,0.3)',alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#44ffaa',fontFamily:'monospace',fontWeight:'900',fontSize:14}}>⊕</Text>
                </View>
                <View>
                  <Text style={{color:'#44ffaa',fontFamily:'monospace',fontWeight:'900',fontSize:14,letterSpacing:1}}>{location.city}</Text>
                  <Text style={{color:'rgba(255,255,255,0.4)',fontFamily:'monospace',fontSize:9,letterSpacing:2,marginTop:1}}>{location.country}</Text>
                </View>
              </View>
              <Text style={{color:'rgba(255,255,255,0.2)',fontFamily:'monospace',fontSize:8,letterSpacing:1}}>
                {location.lat}°N  {location.lon}°E
              </Text>
              <TouchableOpacity onPress={requestLocation} activeOpacity={0.8}
                style={{marginTop:4,paddingVertical:8,borderRadius:8,borderWidth:1,borderColor:'rgba(68,255,170,0.2)',alignItems:'center'}}>
                <Text style={{color:'rgba(68,255,170,0.5)',fontFamily:'monospace',fontSize:9,letterSpacing:2}}>UPDATE LOCATION</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{gap:12}}>
              <View>
                <Text style={{color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontWeight:'900',fontSize:12,letterSpacing:1,marginBottom:4}}>Mark Your Territory</Text>
                <Text style={{color:'rgba(255,255,255,0.38)',fontFamily:'monospace',fontSize:10,lineHeight:16}}>
                  Set your survivor home base. Unlocks the Location badge and shows where you play from.
                </Text>
              </View>
              <TouchableOpacity onPress={requestLocation} activeOpacity={0.85}
                disabled={locStatus==='loading'}
                style={{paddingVertical:13,borderRadius:12,borderWidth:1.5,
                  borderColor:'rgba(68,255,170,0.5)',backgroundColor:'rgba(68,255,170,0.08)',alignItems:'center'}}>
                <Text style={{color:'#44ffaa',fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:3}}>
                  {locStatus==='loading'?'LOCATING...':locStatus==='denied'?'PERMISSION DENIED':'SET HOME BASE'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── BADGES ── */}
        <Text style={{color:'rgba(201,164,76,0.7)',fontFamily:'monospace',fontSize:8,letterSpacing:4,marginBottom:10}}>BADGES</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:8}}>
          {badges.map(b=>(
            <View key={b.id} style={{
              width:'47%', padding:14,borderRadius:14,
              backgroundColor: b.unlocked?`${b.color}0f`:'rgba(255,255,255,0.02)',
              borderWidth:1.5,
              borderColor: b.unlocked?`${b.color}55`:'rgba(255,255,255,0.06)',
              gap:8,
            }}>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={{
                  width:36,height:36,borderRadius:10,
                  backgroundColor: b.unlocked?`${b.color}22`:'rgba(255,255,255,0.04)',
                  borderWidth:1,borderColor: b.unlocked?`${b.color}44`:'rgba(255,255,255,0.06)',
                  alignItems:'center',justifyContent:'center',
                }}>
                  <Text style={{
                    color: b.unlocked?b.color:'rgba(255,255,255,0.15)',
                    fontFamily:'monospace',fontWeight:'900',fontSize:14,
                  }}>{b.sym}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={{
                    color: b.unlocked?b.color:'rgba(255,255,255,0.25)',
                    fontFamily:'monospace',fontWeight:'900',fontSize:10,letterSpacing:1,
                  }}>{b.label}</Text>
                  <Text style={{color: b.unlocked?'rgba(255,255,255,0.45)':'rgba(255,255,255,0.18)',
                    fontFamily:'monospace',fontSize:8,lineHeight:12,marginTop:2}}>{b.desc}</Text>
                </View>
              </View>
              {b.unlocked&&(
                <View style={{height:1,backgroundColor:`${b.color}30`}}/>
              )}
              <Text style={{
                color: b.unlocked?`${b.color}cc`:'rgba(255,255,255,0.15)',
                fontFamily:'monospace',fontSize:8,letterSpacing:2,
                alignSelf:'flex-end',
              }}>{b.unlocked?'UNLOCKED':'LOCKED'}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

function SettingsScreen({ navigation, route }){
  const [mic, setMic] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const onDeleteAccount = route?.params?.onDeleteAccount;

  useEffect(()=>{
    Animated.timing(fadeAnim,{toValue:1,duration:500,useNativeDriver:true}).start();
    let alive=true;
    (async()=>{
      try{
        const raw = await storage.get(PROFILE_KEY);
        if(raw && alive){
          const j = JSON.parse(raw);
          const v = j?.settings?.micEnabled;
          const s = j?.settings?.soundEnabled;
          if(typeof v === 'boolean') setMic(v);
          if(typeof s === 'boolean') setSoundEnabled(s);
        }
      }catch(e){}
    })();
    return ()=>{ alive=false; };
  },[]);

  const saveSetting = async(key, val)=>{
    try{
      const raw = await storage.get(PROFILE_KEY);
      const j = raw ? JSON.parse(raw) : {};
      await storage.set(PROFILE_KEY, JSON.stringify({...j, settings:{...(j?.settings||{}), [key]:val}}));
    }catch(e){}
  };

  const saveMic = async(nextMic)=>{ setMic(nextMic); await saveSetting('micEnabled', nextMic); };
  const saveSound = async(nextSound)=>{ setSoundEnabled(nextSound); await saveSetting('soundEnabled', nextSound); };

  // Compact toggle switch (single pill button)
  const ToggleSwitch = ({label, desc, value, onChange, colorOn='#5ecfa0', colorOff='rgba(255,255,255,0.18)'})=>{
    const knob = useRef(new Animated.Value(value?1:0)).current;
    useEffect(()=>{
      Animated.spring(knob,{toValue:value?1:0,friction:6,tension:100,useNativeDriver:false}).start();
    },[value]);
    const trackW=50, knobSize=22, padding=3;
    const knobLeft=knob.interpolate({inputRange:[0,1],outputRange:[padding,trackW-knobSize-padding]});
    const trackColor=knob.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.08)',colorOn+'55']});
    const trackBorder=knob.interpolate({inputRange:[0,1],outputRange:[colorOff,colorOn]});
    return(
      <View style={{padding:16,borderRadius:14,backgroundColor:'rgba(255,255,255,0.025)',
        borderWidth:1,borderColor:'rgba(255,255,255,0.07)',marginBottom:10,
        flexDirection:'row',alignItems:'center',gap:14}}>
        <View style={{flex:1}}>
          <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',fontSize:11,letterSpacing:2,marginBottom:3}}>{label}</Text>
          <Text style={{color:'rgba(255,255,255,0.35)',fontFamily:'monospace',fontSize:9,lineHeight:14}}>{desc}</Text>
        </View>
        <TouchableOpacity onPress={()=>onChange(!value)} activeOpacity={0.85}>
          <Animated.View style={{
            width:trackW, height:knobSize+padding*2, borderRadius:(knobSize+padding*2)/2,
            backgroundColor:trackColor, borderWidth:1.5, borderColor:trackBorder,
            justifyContent:'center',
          }}>
            <Animated.View style={{
              position:'absolute', left:knobLeft,
              width:knobSize, height:knobSize, borderRadius:knobSize/2,
              backgroundColor:value?colorOn:'rgba(255,255,255,0.35)',
              shadowColor:value?colorOn:'#000',shadowRadius:4,shadowOpacity:0.6,elevation:3,
            }}/>
          </Animated.View>
        </TouchableOpacity>
        <Text style={{color:value?colorOn:'rgba(255,255,255,0.30)',fontFamily:'monospace',
          fontSize:9,fontWeight:'900',letterSpacing:1,minWidth:40,textAlign:'right'}}>
          {value?'ON':'OFF'}
        </Text>
      </View>
    );
  };

  return(
    <View style={{flex:1,backgroundColor:'#050508'}}>
      <Animated.View style={{flex:1,opacity:fadeAnim}}>
        <ScrollView contentContainerStyle={{padding:20,paddingBottom:40}} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:24,paddingTop:4}}>
            <View>
              <Text style={{color:'rgba(255,255,255,0.22)',fontFamily:'monospace',fontSize:8,letterSpacing:5,marginBottom:4}}>THE LAST FLOOR</Text>
              <Text style={{color:'#e8dcc8',fontFamily:'monospace',fontWeight:'900',fontSize:20,letterSpacing:5}}>SETTINGS</Text>
            </View>
            <TouchableOpacity
              onPress={()=>{
                try{ navRef.current?.goBack(); }
                catch(e){ try{ navigation.getParent()?.goBack(); }catch(ee){} }
              }}
              activeOpacity={0.8}
              style={{paddingHorizontal:14,paddingVertical:10,borderRadius:10,
                borderWidth:1,borderColor:'rgba(255,255,255,0.14)',backgroundColor:'rgba(255,255,255,0.03)'}}>
              <Text style={{color:'rgba(255,255,255,0.6)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>BACK</Text>
            </TouchableOpacity>
          </View>

          {/* Section label */}
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
            <Text style={{color:'rgba(201,164,76,0.6)',fontFamily:'monospace',fontSize:8,letterSpacing:4}}>AUDIO</Text>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
          </View>

          <ToggleSwitch
            label="MICROPHONE LURE"
            desc={"In Dark Mode, loud sounds attract nearby ghosts. Enable to use your microphone for this effect."}
            value={mic}
            onChange={saveMic}
            colorOn='#5ecfa0'
          />

          <ToggleSwitch
            label="GAME SOUNDS"
            desc={"Toggle all in-game audio: footsteps, ghost voices, ambient sounds, and alarm effects."}
            value={soundEnabled}
            onChange={saveSound}
            colorOn='#c9a44c'
          />

          {/* Section label */}
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12,marginTop:8}}>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
            <Text style={{color:'rgba(201,164,76,0.6)',fontFamily:'monospace',fontSize:8,letterSpacing:4}}>ABOUT</Text>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
          </View>

          <View style={{padding:18,borderRadius:16,backgroundColor:'rgba(255,255,255,0.02)',
            borderWidth:1,borderColor:'rgba(255,255,255,0.06)',gap:14}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>GAME</Text>
              <Text style={{color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontWeight:'900',fontSize:10,letterSpacing:1}}>The Last Floor</Text>
            </View>
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.05)'}}/>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>MADE BY</Text>
              <Text style={{color:'rgba(201,164,76,0.9)',fontFamily:'monospace',fontWeight:'900',fontSize:10,letterSpacing:1}}>Zahraa · Waad · Renad</Text>
            </View>
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.05)'}}/>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>FLOORS</Text>
              <Text style={{color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontWeight:'900',fontSize:10}}>4</Text>
            </View>
            <View style={{height:1,backgroundColor:'rgba(255,255,255,0.05)'}}/>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:'rgba(255,255,255,0.3)',fontFamily:'monospace',fontSize:10,letterSpacing:2}}>BUILT WITH</Text>
              <Text style={{color:'rgba(255,255,255,0.7)',fontFamily:'monospace',fontSize:10}}>React Native · Expo</Text>
            </View>
          </View>

          {/* M4.2: DANGER ZONE — Delete Account (CRUD Delete: permanently wipes all user data) */}
          <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12,marginTop:20}}>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
            <Text style={{color:'rgba(255,80,80,0.6)',fontFamily:'monospace',fontSize:8,letterSpacing:4}}>DANGER ZONE</Text>
            <View style={{flex:1,height:1,backgroundColor:'rgba(255,255,255,0.06)'}}/>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={()=>{
              Alert.alert(
                'Delete Account',
                'This will permanently delete ALL your data:\n\n• Profile & name\n• Coins & stats\n• Achievements & progress\n• Character selection\n• Location & settings data\n\nThis CANNOT be undone.',
                [
                  {text:'Cancel',style:'cancel'},
                  {text:'DELETE EVERYTHING',style:'destructive',onPress:async()=>{
                    try{
                      // Wipe all keys from both AsyncStorage and in-memory store
                      for(const key of ALL_STORAGE_KEYS){
                        try{ delete _memStore[key]; }catch(e){}
                      }
                      if(AsyncStorage){
                        try{ await AsyncStorage.multiRemove(ALL_STORAGE_KEYS); }catch(e){
                          for(const key of ALL_STORAGE_KEYS){
                            try{ await AsyncStorage.removeItem(key); }catch(ee){}
                          }
                        }
                      } else {
                        // Web fallback: clear memStore
                        ALL_STORAGE_KEYS.forEach(k=>{ _memStore[k]=null; });
                      }
                      Alert.alert(
                        'Done',
                        'All data permanently deleted. App will now reset.',
                        [{text:'OK',onPress:()=>{
                          // Reset all in-memory GameCore state via the callback
                          if(typeof onDeleteAccount === 'function'){
                            onDeleteAccount();
                          } else {
                            // Fallback: pop back and GameCore will re-load clean
                            try{ navRef.current?.goBack(); }
                            catch(e){ try{ navigation.getParent()?.goBack(); }catch(ee){} }
                          }
                        }}]
                      );
                    }catch(err){
                      Alert.alert('Error',`Could not delete: ${err?.message||'Unknown error'}`);
                    }
                  }},
                ]
              );
            }}
            style={{
              padding:18,borderRadius:16,
              backgroundColor:'rgba(255,30,30,0.06)',
              borderWidth:1.5,borderColor:'rgba(255,80,80,0.35)',
              alignItems:'center',marginBottom:8,
            }}>
            <Text style={{color:'#ff5566',fontFamily:'monospace',fontWeight:'900',fontSize:12,letterSpacing:3}}>
              DELETE ACCOUNT
            </Text>
            <Text style={{color:'rgba(255,120,120,0.5)',fontFamily:'monospace',fontSize:9,marginTop:5,letterSpacing:1,textAlign:'center'}}>
              Permanently removes all profile, coins, stats and progress
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

// M3.3: Stack + Tab navigator setup to satisfy "multiple navigator types" requirement
const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// Tab navigator wrapping Settings + Achievements screens
function SettingsTabNavigator(){
  return(
    <Tab.Navigator
      screenOptions={{
        headerShown:false,
        tabBarStyle:{
          backgroundColor:'#050508',
          borderTopColor:'rgba(255,255,255,0.10)',
          borderTopWidth:1,
          height:46,
        },
        tabBarActiveTintColor:'#c9a44c',
        tabBarInactiveTintColor:'rgba(255,255,255,0.35)',
        tabBarLabelStyle:{fontFamily:'monospace',fontSize:9,letterSpacing:2},
      }}
    >
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{tabBarLabel:'SETTINGS',tabBarIcon:()=>null}}
      />
      <Tab.Screen
        name="AchievementsTab"
        component={AchievementsScreen}
        options={{tabBarLabel:'ACHIEVEMENTS',tabBarIcon:()=>null}}
      />
    </Tab.Navigator>
  );
}

export default function App(){
  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown:false }}>
        <Stack.Screen name="Game" component={GameCore} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        {/* M3.3: SettingsTabNavigator nests a Tab navigator inside the Stack — two navigator types */}
        <Stack.Screen name="Settings" component={SettingsTabNavigator} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}