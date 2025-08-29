const MODULE_ID = "damage-tracker";
const LOG_PREFIX = `${MODULE_ID} |`;
const UNIDENTIFIED_ATTACKER = "Unidentified Source";
var isDebug = false;

console.log(LOG_PREFIX, MODULE_ID, "is loaded.");

Hooks.on("clientSettingChanged", (settingKey, newValue) => {
  if (settingKey === MODULE_ID+".isDebug") {
    console.log(LOG_PREFIX, `"isDebug" setting changed to: ${newValue}`);

    isDebug = newValue;
  }
});


Hooks.on("createChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(LOG_PREFIX, "createChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
  
  if (isDebug) console.log(LOG_PREFIX, "ChatMessagePF2e call detected");

  //Get actual damage being applied
  if (message.flags.pf2e.context?.type === "damage-taken") {
    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
    let attackerId =  message.flags.pf2e.origin?.actor;
    const attackActor = (attackerId)?fromUuidSync(attackerId):null;
    const attacker =    (attackActor)?attackActor.name:UNIDENTIFIED_ATTACKER;       //Probably should use token.name here for NPCs (to get decorated names) - should I lose attackerId (I don't use it to render)
    let isNPC =       (attackActor?.type !== "character");

    if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
      isNPC =       false;      // since it might be from a PC, we need to treat it as such
      attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
    }

    const damageRegex = /span>\stakes\s(\d+)\sdamage./;
    const damageString = message.content;
    const validUpdate = message.flags.pf2e.appliedDamage?.updates;  //if missing, 0 damage done - process to get damageRoll anyway
    const damage =      (validUpdate)?validUpdate[0].value:0;
    const victim =      fromUuidSync(message.flags.pf2e.appliedDamage?.uuid)?.name;
        
    if ((!isNPC) || (isNPCLoggingEnabled)) {
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (dmgMatch) {
            damageRoll = parseInt(dmgMatch[1],10);
      }
      
      if (isDebug) {
        console.log(LOG_PREFIX, "Damage Taken!");
        console.log(LOG_PREFIX, "damage Amount: \t", damageRoll);
        console.log(LOG_PREFIX, "damage: \t", damage);
        console.log(LOG_PREFIX, "attacker: \t", attacker);
        console.log(LOG_PREFIX, "attacker is NPC?:", isNPC)
        console.log(LOG_PREFIX, "victim: \t", victim);
        console.log(LOG_PREFIX, "track NPCs?", isNPCLoggingEnabled);
      }

      AddOrMergeActor(attackerId, attacker, isNPC, damageRoll, damage);
    }
  }

  //Stash damage rolls for later reference (when damage is applied)
  //This looks very similar to the block above, but I'm doing a couple things different
  //  1. I'm only getting the damage roll for the attacker (there is no victim yet).
  //  2. I'm using the attackerId (same as above) as the key to store the data, but I'm 
  //        logging the token name (instead of the actor.name).
  if (message.flags.pf2e.context?.type === "damage-roll") {
    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
    const attackerTokenId = message.flags.pf2e.context?.token;
    const attackerTokenName = canvas.tokens.get(attackerTokenId).name;
    let attackerId =  message.flags.pf2e.origin?.actor;
    const attackActor = (attackerId)?fromUuidSync(attackerId):null;
    let isNPC =       (attackActor?.type !== "character");

    if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
      isNPC =       false;      // since it might be from a PC, we need to treat it as such
      attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
    }

    if ((!isNPC) || (isNPCLoggingEnabled)) {

      //accumulate all damage roll totals.. not sure this is what we want vs. take largest.
      let damageRoll = 0;
      message.rolls.forEach(r => {
        damageRoll = Math.max(damageRoll,r.total);
      });
            
      if (isDebug) {
        console.log(LOG_PREFIX, "Damage Taken!");
        console.log(LOG_PREFIX, "damage Amount: \t", damageRoll);
        console.log(LOG_PREFIX, "attacker token name: \t", attackerTokenName);
        console.log(LOG_PREFIX, "attacker is NPC?:", isNPC)
        console.log(LOG_PREFIX, "track NPCs?", isNPCLoggingEnabled);
      }

      StashDamageRoll(attackerId, attackerTokenName, isNPC, damageRoll);
    }
  }
});

//Listen for damage "reverts" and clear that data
Hooks.on("updateChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(LOG_PREFIX, "UpdateChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
    
  if (isDebug) console.log(LOG_PREFIX, "ChatMessagePF2e call detected");

  if (message.flags.pf2e.context?.type === "damage-taken") {
      
    if (!message.flags.pf2e.appliedDamage.updates) return;    

    if (data.flags.pf2e.appliedDamage.isReverted)
    {
      if (isDebug) console.log(LOG_PREFIX, "Revert damage found");

      let attackerId =  message.flags.pf2e.origin?.actor;
      const attackActor = (attackerId)?fromUuidSync(attackerId):null;
      let isNPC =       (attackActor?.type !== "character");

      if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
        isNPC =       false;                  //since it might be from a PC, we need to treat it as such
        attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
      }

      const damageRegex = /span>\stakes\s(\d+)\sdamage./;
      const damageString = data.content;
      const damage =      message.flags.pf2e.appliedDamage.updates[0].value;
        
              
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (!dmgMatch) 
         return;
        
      damageRoll = parseInt(dmgMatch[1],10);
        
      if (isDebug) {
        console.log(LOG_PREFIX, "Damage Reverted!");
        console.log(LOG_PREFIX, "damage: \t", damage);
      }

      RevertDamage(attackerId, damageRoll, damage);
    }
  }
});

async function StashDamageRoll(key, name, isNPC, damageRoll) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
  
  if (!actorMap[key]) {   //create new actor in damageRolls  (this is likely to be where all new actors get created.)
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].prevMaxDmgRoll = 0;

    if (isDebug) console.log(LOG_PREFIX, "Created new", (isNPC)?"NPC":"PC", "for:", name, "with", damageRoll, "damage.");
  } else {
    const existing = actorMap[key];
    if (!checkAndUpdateMaxDmgRoll(existing,damageRoll)) {
      // short circuit, no changes are required, don't bother setting data
      return;
    }
    if (isDebug) console.log(LOG_PREFIX, "Merged data into existing", (isNPC)?"NPC":"PC", "for:", existing.name, "with", damageRoll, "damage.");
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
  
}


// Return true if something changed, otherwise false.
function checkAndUpdateMaxDmgRoll(actor,damageRoll) {
  let currentMax = (actor.maxDmgRoll)?actor.maxDmgRoll:0;
  
  if (damageRoll > currentMax) {
    actor.prevMaxDmgRoll = currentMax;
    actor.maxDmgRoll = damageRoll;
    return true;
  } 
  // if the roll isn't bigger than the current max, but it is bigger than previous, update previous max.
  // Explicity not doing anything on damageRoll == currentMax since this potentially gets called twice
  // for damaging someone (damage roll, then damage hit).. If I recorded both it wouldn't revert (max and previous would be the same).
  if ((damageRoll > actor.prevMaxDmgRoll) && (damageRoll < currentMax)) {
    actor.prevMaxDmgRoll = damageRoll;
    return true;
  }
  return false;
}

// Don't need to return a value, anytime maxDmg is checked they'll be updating totDmg
function checkAndUpdateMaxDmg(actor,damage) {
  let currentMax = (actor.maxDmg)?actor.maxDmg:0;
  if (damage > currentMax) {
    actor.prevMaxDmg = currentMax;
    actor.maxDmg = damage;
  } else {
    // if the damage isn't bigger than the current max, but it is bigger than previous, update previous max.
    // This will mostly likely occur due to a revert (that set previous max to 0).
    // MaxDmg shouldn't have the same problem as MaxDmgRoll since it's only updated when damage is applied.
    if ((damage > actor.prevMaxDmg)) {
      actor.prevMaxDmg = damage;
    }
  }
}
      
async function AddOrMergeActor(key, name, isNPC, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {   
    // Create new actor in damageMap.  
    // This should be rare, the damage roll should have happened before applying damage 
    // (in which case StashDamageRoll should have created the actor) and given it name = token.name.
    // If this does create an actor it will be using actor.name (which wil be fine for linked actors).
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].prevMaxDmgRoll = 0;
    actorMap[key].maxDmg = damage;
    actorMap[key].prevMaxDmg = 0;
    actorMap[key].totDmg = damage;

    const Actortype = (isNPC)?"NPC":"PC";
    
    if (isDebug) console.log(LOG_PREFIX, "Created new", (isNPC)?"NPC":"PC", "for:", name, "with", damage, "damage.");
  } else {    //actor already exists, update
    const actor = actorMap[key];
    const Actortype = (actor.isNPC)?"NPC":"PC";
    
    let absMaxDmg = Math.max(damageRoll,damage);  //if damage is > damageRoll, use that.. 

    checkAndUpdateMaxDmgRoll(actor,absMaxDmg);
    checkAndUpdateMaxDmg(actor,damage);

    actor.totDmg = (actor.totDmg)?actor.totDmg + damage:damage;
    
    if (isDebug) console.log(LOG_PREFIX, "Merged data into existing", (isNPC)?"NPC":"PC", "for:", actor.name, "with", damage, "damage.");
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}

async function RevertDamage(key, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {  
    if (isDebug) console.log(LOG_PREFIX, "Actor is not in the table to revert damage from");
  } else {    //actor already exists, update
    const actor = actorMap[key];
    const Actortype = (actor.isNPC)?"NPC":"PC";
    
    if (actor.maxDmgRoll == damageRoll) {
      actor.maxDmgRoll = actor.prevMaxDmgRoll;
      actor.prevMaxDmgRoll = 0;     //don't save the current or it could never revert that roll.  Shouldn't happen, but just in case.

    }    
    
    if (actor.maxDmg == damage) {
      actor.maxDmg = actor.prevMaxDmg;
      actor.prevMaxDmg = 0;     //don't save the current or it could never revert that roll.  Shouldn't happen, but just in case.
    }

    actor.totDmg += -damage;

    if (isDebug) console.log(LOG_PREFIX, "Reverted damage from existing", (actor.isNPC)?"NPC":"PC", "for:", actor.name, "with", damage, "damage.");
  
    await game.settings.set(MODULE_ID, "damageMap", actorMap);
    
  }
  
}
