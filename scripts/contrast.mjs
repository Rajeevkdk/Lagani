import {readFileSync} from 'node:fs';
const tokens=JSON.parse(readFileSync(new URL('../packages/design-tokens/tokens.json',import.meta.url)));
const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
let fails=0;
for(const mode of ['light','dark'])for(const [fg,bg]of [['text','background'],['secondary','background'],['text','surface'],['secondary','surface'],['onPrimary','primary'],['error','background'],['success','background']]){const a=luminance(tokens[mode][fg]),b=luminance(tokens[mode][bg]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);console.log(`${mode} ${fg}/${bg}: ${ratio.toFixed(2)}:1 ${ratio>=4.5?'PASS':'FAIL'}`);if(ratio<4.5)fails++;}
process.exitCode=fails?1:0;
