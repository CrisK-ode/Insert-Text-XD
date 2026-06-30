const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const arena = document.getElementById('arena');
const waveEl = document.getElementById('wave');
const levelEl = document.getElementById('level');
const hpEl = document.getElementById('hp');
const xpFill = document.getElementById('xpfill');
const statsEl = document.getElementById('stats');
const logEl = document.getElementById('log');
const pauseBadge = document.getElementById('pauseBadge');

const keys = {};
const mouse = { x: 0, y: 0, down: false };
// Virtual joystick input for mobile
const vJoy = { x: 0, y: 0 };
const upgradeStats = ['damage', 'maxHp', 'speed', 'bulletSize', 'fireCooldown'];
const sprites = {
	player: loadSprite('IMG/torreta.png'),
	bullet: loadSprite('IMG/Cateto.png'),
	enemyBullet: loadSprite('IMG/Cateto.png'),
	normal: loadSprite('IMG/flarogus.png'),
	bomber: loadSprite('IMG/Quemadod.png'),
	speed: loadSprite('IMG/duol.png'),
	tank: loadSprite('IMG/flarogus.png'),
	healer: loadSprite('IMG/chat.jpg'),
	boss: loadSprite('IMG/Pearto.png'),
	auraMonster: loadSpriteCandidates(['IMG/Subaru_Sprites/Aura_Monster.png', 'IMG/Aura_Monster.png']),
	subaru: loadSpriteCandidates(['IMG/Subaru_Sprites/Subaru_Bucle_1.png', 'IMG/Subaru_Sprites/Subaru_Bucle_2.png']),
	subaruWhip: loadSpriteCandidates(['IMG/Subaru_Sprites/Subaru_Bucle_2.png', 'IMG/Subaru_Sprites/Subaru_Bucle_1.png']),
	subaruRock: loadSpriteCandidates(['IMG/Subaru_Sprites/Subaru_Bucle_2.png', 'IMG/Subaru_Sprites/Subaru_Bucle_1.png']),
	beatrice: loadSpriteCandidates(['IMG/Beako_Sprites/Beako.png', 'IMG/Beako_Sprites/Beako_Ataque_seguido.png']),
	beatriceIce: loadSpriteCandidates(['IMG/Beako_Sprites/Beako_Ataque_en_Fila.png', 'IMG/Beako_Sprites/Beako_Ataque_seguido.png']),
	reinhard: loadSpriteCandidates(['IMG/Reinhard_Sprites/Reinhard_Invocado.png', 'IMG/Reinhard_Sprites/Reinhard_Preparado.png']),
	reinhardDash: loadSpriteCandidates(['IMG/Reinhard_Sprites/Reinhard_Preparado.png', 'IMG/Reinhard_Sprites/Reinhard_Ataque_1.png']),
	reinhardAttack2: loadSpriteCandidates(['IMG/Reinhard_Sprites/Reinhard_Ataque_2.png', 'IMG/Reinhard_Sprites/Reinhard_Ataque_1.png']),
	reinhardSword: loadSpriteCandidates(['IMG/Reinhard_Sprites/Espada_Reinhard.png', 'IMG/Reinhard_Sprites/Espada_Reinhard.png'])
};

let player;
let bullets = [];
let enemyProjectiles = [];
let enemies = [];
let drops = [];
let particles = [];
let wave = 0;
let enemyTimer = 0;
let spawnCount = 0;
let waveDelay = 0;
let wavePending = false;
let bossSpawned = false;
let gameActive = false;
let paused = false;
let auraFight = null;
const forceBossTest = false;

function loadSprite(src){
	const image = new Image();
	image.src = src;
	return image;
}

function loadSpriteCandidates(paths){
	const image = new Image();
	let index = 0;
	image.onerror = () => {
		index++;
		if(index < paths.length){
			image.src = paths[index];
		}
	};
	image.src = paths[index];
	return image;
}

function resizeCanvas(){
	const rect = arena.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	canvas.width = Math.max(320, Math.floor(rect.width * dpr));
	canvas.height = Math.max(240, Math.floor(rect.height * dpr));
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	canvas.logicalWidth = rect.width;
	canvas.logicalHeight = rect.height;
	if(player){
		player.x = clamp(player.x, player.radius, canvas.logicalWidth - player.radius);
		player.y = clamp(player.y, player.radius, canvas.logicalHeight - player.radius);
	}
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document.addEventListener('keydown', (event) => {
	const key = event.key.toLowerCase();
	keys[key] = true;
	if(key === 'p' && gameActive){
		togglePause();
	}
});
document.addEventListener('keyup', (event) => keys[event.key.toLowerCase()] = false);

canvas.addEventListener('pointermove', updatePointer);
canvas.addEventListener('pointerdown', (event) => {
	updatePointer(event);
	mouse.down = true;
	canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', () => mouse.down = false);
canvas.addEventListener('pointercancel', () => mouse.down = false);

function updatePointer(event){
	const rect = canvas.getBoundingClientRect();
	mouse.x = event.clientX - rect.left;
	mouse.y = event.clientY - rect.top;
}

// Mobile controls hookup
const leftStick = document.getElementById('leftStick');
const rightPad = document.getElementById('rightPad');
const fireButton = document.getElementById('fireButton');

let leftActiveId = null;
let leftOrigin = { x: 0, y: 0 };

if(leftStick){
	leftStick.addEventListener('pointerdown', (e) => {
		leftStick.setPointerCapture(e.pointerId);
		leftActiveId = e.pointerId;
		const rect = leftStick.getBoundingClientRect();
		leftOrigin.x = rect.left + rect.width / 2;
		leftOrigin.y = rect.top + rect.height / 2;
		handleLeftMove(e.clientX, e.clientY);
	});

	leftStick.addEventListener('pointermove', (e) => {
		if(leftActiveId !== e.pointerId) return;
		handleLeftMove(e.clientX, e.clientY);
	});

	leftStick.addEventListener('pointerup', (e) => {
		if(leftActiveId !== e.pointerId) return;
		leftStick.releasePointerCapture(e.pointerId);
		leftActiveId = null;
		vJoy.x = 0; vJoy.y = 0;
	});

	// Touch fallback
	leftStick.addEventListener('touchstart', (ev) => {
		ev.preventDefault();
		const t = ev.changedTouches[0];
		leftActiveId = t.identifier;
		const rect = leftStick.getBoundingClientRect();
		leftOrigin.x = rect.left + rect.width / 2;
		leftOrigin.y = rect.top + rect.height / 2;
		handleLeftMove(t.clientX, t.clientY);
	}, {passive:false});
	leftStick.addEventListener('touchmove', (ev) => {
		ev.preventDefault();
		const t = ev.changedTouches[0];
		handleLeftMove(t.clientX, t.clientY);
	}, {passive:false});
	leftStick.addEventListener('touchend', (ev) => {
		ev.preventDefault();
		leftActiveId = null;
		vJoy.x = 0; vJoy.y = 0;
	}, {passive:false});
}

function handleLeftMove(clientX, clientY){
	const dx = clientX - leftOrigin.x;
	const dy = clientY - leftOrigin.y;
	const max = 44; // matches knob visual
	const dist = Math.hypot(dx, dy);
	const nx = dist > 0 ? dx / dist : 0;
	const ny = dist > 0 ? dy / dist : 0;
	const mag = Math.min(1, dist / max);
	vJoy.x = nx * mag;
	vJoy.y = ny * mag;
}

// Right pad: aim and hold to shoot
if(rightPad){
	let activeR = null;
	rightPad.addEventListener('pointerdown', (e) => {
		rightPad.setPointerCapture(e.pointerId);
		activeR = e.pointerId;
		updatePointer(e);
		mouse.down = true;
	});
	rightPad.addEventListener('pointermove', (e) => {
		if(activeR !== e.pointerId) return;
		updatePointer(e);
	});
	rightPad.addEventListener('pointerup', (e) => {
		if(activeR !== e.pointerId) return;
		rightPad.releasePointerCapture(e.pointerId);
		activeR = null;
		mouse.down = false;
	});

	// Touch fallback for right pad
	rightPad.addEventListener('touchstart', (ev) => {
		ev.preventDefault();
		const t = ev.changedTouches[0];
		updatePointer(t);
		mouse.down = true;
	}, {passive:false});
	rightPad.addEventListener('touchmove', (ev) => {
		ev.preventDefault();
		const t = ev.changedTouches[0];
		updatePointer(t);
	}, {passive:false});
	rightPad.addEventListener('touchend', (ev) => {
		ev.preventDefault();
		mouse.down = false;
	}, {passive:false});
}

if(fireButton){
	fireButton.addEventListener('pointerdown', (e) => { e.preventDefault(); mouse.down = true; });
	fireButton.addEventListener('pointerup', (e) => { e.preventDefault(); mouse.down = false; });
	fireButton.addEventListener('pointercancel', (e) => { mouse.down = false; });
	// Touch fallback
	fireButton.addEventListener('touchstart', (ev) => { ev.preventDefault(); mouse.down = true; }, {passive:false});
	fireButton.addEventListener('touchend', (ev) => { ev.preventDefault(); mouse.down = false; }, {passive:false});
}

function rand(min, max){ return Math.random() * (max - min) + min; }
function choose(items){ return items[Math.floor(Math.random() * items.length)]; }
function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }

function createPlayer(){
	return {
		x: canvas.logicalWidth / 2,
		y: canvas.logicalHeight / 2,
		radius: 15,
		maxHp: 100,
		hp: 100,
		damage: 1,
		speed: 240,
		slowTimer: 0,
		slowMultiplier: 1,
		fireCooldown: 240,
		bulletSize: 9,
		bulletSpeed: 620,
		lastShot: 0,
		level: 1,
		xp: 0,
		xpToNext: 12
	};
}

function spawnWave(){
	wave++;
	spawnCount = getWaveEnemyCount(wave);
	enemyTimer = 0;
	waveDelay = 0;
	wavePending = false;
	bossSpawned = false;
	auraFight = null;
	waveEl.textContent = `Oleada: ${wave}`;
	log(`Oleada ${wave} iniciada`);
}

function getWaveEnemyCount(currentWave){
	if(currentWave === 1) return 24;
	return Math.floor(10 * Math.pow(1.28, currentWave - 2));
}

function spawnEnemy(isBoss = false){
	const width = canvas.logicalWidth;
	const height = canvas.logicalHeight;
	const side = Math.floor(rand(0, 4));
	const x = side === 0 ? -30 : side === 1 ? width + 30 : rand(0, width);
	const y = side === 2 ? -30 : side === 3 ? height + 30 : rand(0, height);
	let type = isBoss ? 'boss' : 'normal';

	if(!isBoss){
		const roll = Math.random();
		if(wave === 1){
			if(roll < 0.08) type = 'bomber';
			else if(roll < 0.2) type = 'speed';
			else if(roll < 0.3) type = 'tank';
		}else{
			if(roll < 0.22) type = 'bomber';
			else if(roll < 0.45) type = 'speed';
			else if(roll < 0.68) type = 'tank';
			else if(roll < 0.86) type = 'healer';
		}
	}

	const strengthMultiplier = wave === 1 ? 1 : Math.pow(1.18, wave - 1);
	const base = (7 + wave * 2.2) * strengthMultiplier;
	const enemy = {
		x, y,
		radius: isBoss ? 42 : 13,
		hp: base,
		maxHp: base,
		speed: (rand(48, 82) + wave * 1.4) * (wave === 1 ? 1 : 1 + Math.min(0.45, (wave - 1) * 0.025)),
		damage: (4 + Math.floor(wave / 4)) * (wave === 1 ? 1 : 1 + Math.min(1.2, (wave - 1) * 0.12)),
		attackCooldown: 0.9,
		lastAttack: 0,
		type,
		isBoss,
		healTimer: 0,
		wobble: rand(0, Math.PI * 2),
		exploding: false,
		explosionTimer: 0,
		explosionRadius: 0
	};

	if(type === 'boss'){
		enemy.hp = base * (7 + Math.floor(wave / 10));
		enemy.maxHp = enemy.hp;
		enemy.speed = 34 + wave * 0.4;
		enemy.damage = 14 + wave;
		enemy.attackCooldown = 1.25;
	}
	if(type === 'bomber'){
		enemy.radius = 20;
		enemy.hp = Math.max(4, base * 0.45);
		enemy.maxHp = enemy.hp;
		enemy.damage = Math.max(8, enemy.damage * 1.1);
		enemy.speed *= 4.35;
		enemy.attackCooldown = 0.25;
	}
	if(type === 'speed'){
		enemy.speed *= 1.65;
		enemy.attackCooldown = 0.65;
	}
	if(type === 'tank'){
		enemy.radius = 18;
		enemy.hp *= 2.3;
		enemy.maxHp = enemy.hp;
		enemy.damage *= 1.8;
		enemy.speed *= 0.62;
	}
	if(type === 'healer'){
		enemy.hp *= 1.25;
		enemy.maxHp = enemy.hp;
		enemy.speed *= 0.9;
	}

	enemies.push(enemy);
}

function spawnAuraMonsterFight(loop = 1){
	auraFight = {
		active: true,
		loop,
		rewinds: loop - 1,
		startSnapshot: captureFightSnapshot(),
		reinhardBanished: loop === 1,
		reinhardReturnTimer: 0,
		learnedFromPlayer: loop > 1,
		intro: null
	};
	enemies = [];
	bullets = [];
	enemyProjectiles = [];
	drops = [];
	particles = [];
	spawnAuraMonster(loop);
	if(loop === 2){
		startReinhardIntro();
	}
	log(loop === 1 ? 'Aura Monster apareció.' : 'El tiempo volvió: segundo bucle.');
}

function startReinhardIntro(){
	if(!auraFight) return;
	auraFight.reinhardBanished = false;
	auraFight.intro = {
		active: true,
		index: 0,
		timer: 0,
		flash: 0,
		spawnedReinhard: false,
		lines: [
			{ speaker: 'Subaru', text: 'REINHARD!!!', duration: 1.25, shout: true },
			{ speaker: 'Reinhard', text: 'Mi amigo Subaru, ¿Tienes algún problema?', duration: 2.25, spawn: true },
			{ speaker: 'Subaru', text: 'Hola Reinhard, sí, tengo un problema con este de aquí me gustaría que me ayudes a derrotarlo.', duration: 3.4 },
			{ speaker: 'Reinhard', text: 'Entendido mi amigo, entonces comenzaré yo, tú busca la manera de poder ganar.', duration: 3.25 },
			{ speaker: 'Subaru', text: 'NO TE CONTENGAS REINHARD!', duration: 1.7, shout: true }
		]
	};
}

function captureFightSnapshot(){
	return {
		x: player.x,
		y: player.y,
		hp: player.hp,
		maxHp: player.maxHp,
		damage: player.damage,
		speed: player.speed,
		fireCooldown: player.fireCooldown,
		bulletSize: player.bulletSize,
		bulletSpeed: player.bulletSpeed,
		level: player.level,
		xp: player.xp,
		xpToNext: player.xpToNext
	};
}

function restoreFightSnapshot(snapshot){
	Object.assign(player, snapshot);
	player.lastShot = 0;
	player.slowTimer = 0;
	player.slowMultiplier = 1;
}

function spawnAuraMonster(loop){
	const hp = loop === 1 ? 520 : 620;
	enemies.push({
		x: canvas.logicalWidth / 2,
		y: 90,
		radius: 32,
		hp,
		maxHp: hp,
		speed: loop === 1 ? 62 : 68,
		damage: loop === 1 ? 8 : 10,
		attackCooldown: 1,
		lastAttack: 0,
		type: 'auraMonster',
		isBoss: true,
		loop,
		healTimer: 0,
		wobble: rand(0, Math.PI * 2),
		specialTimer: 1.5,
		invisibleTimer: 3,
		whipTimer: 1.1,
		dashTimer: 0,
		beatriceTimer: 2.2,
		beatriceMeleeTimer: 0,
		beatriceSpriteTimer: 0
	});
}

function spawnReinhard(){
	enemies.push({
		x: canvas.logicalWidth - 90,
		y: 90,
		radius: 34,
		hp: 5000,
		maxHp: 5000,
		speed: 135,
		damage: 300,
		attackCooldown: 1.8,
		lastAttack: 0,
		type: 'reinhard',
		isBoss: true,
		revivesLeft: 1,
		wobble: 0,
		dashTimer: 1,
		dashWindup: 0,
		spriteState: 'idle',
		spriteTimer: 0
	});
}

function log(text){
	logEl.textContent = text;
	createToast(text);
}

function createToast(text){
	const toast = document.createElement('div');
	toast.className = 'toast';
	toast.textContent = text;
	document.getElementById('toastContainer').appendChild(toast);
	setTimeout(() => {
		toast.classList.add('hide');
		setTimeout(() => toast.remove(), 260);
	}, 2200);
}

function update(dt){
	if(!gameActive || paused) return;
	if(updateAuraFight(dt)) return;
	updateStatusEffects(dt);
	movePlayer(dt);
	shoot();
	updateBullets(dt);
	updateEnemyProjectiles(dt);
	updateEnemies(dt);
	updateDrops(dt);
	updateParticles(dt);
	updateWave(dt);
	updateUI();
}

function movePlayer(dt){
	let vx = 0;
	let vy = 0;
	if(keys.w || keys.arrowup) vy -= 1;
	if(keys.s || keys.arrowdown) vy += 1;
	if(keys.a || keys.arrowleft) vx -= 1;
	if(keys.d || keys.arrowright) vx += 1;

	// If virtual joystick has input, prefer it (mobile)
	if(Math.hypot(vJoy.x, vJoy.y) > 0.05){
		vx = vJoy.x;
		vy = vJoy.y;
	}

	const length = Math.hypot(vx, vy) || 1;
	const speed = player.speed * player.slowMultiplier;
	player.x += vx / length * speed * dt;
	player.y += vy / length * speed * dt;
	player.x = clamp(player.x, player.radius, canvas.logicalWidth - player.radius);
	player.y = clamp(player.y, player.radius, canvas.logicalHeight - player.radius);
}

function shoot(){
	if(!mouse.down) return;
	const now = performance.now();
	if(now - player.lastShot < player.fireCooldown) return;

	player.lastShot = now;
	const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
	bullets.push({
		x: player.x + Math.cos(angle) * (player.radius + player.bulletSize * 0.5),
		y: player.y + Math.sin(angle) * (player.radius + player.bulletSize * 0.5),
		vx: Math.cos(angle) * player.bulletSpeed,
		vy: Math.sin(angle) * player.bulletSpeed,
		angle,
		size: player.bulletSize,
		dmg: player.damage,
		life: 1.15
	});
}

function updateStatusEffects(dt){
	if(player.slowTimer > 0){
		player.slowTimer -= dt;
		if(player.slowTimer <= 0){
			player.slowTimer = 0;
			player.slowMultiplier = 1;
			log('Recuperaste tu velocidad.');
		}
	}
}

function updateBullets(dt){
	for(let i = bullets.length - 1; i >= 0; i--){
		const bullet = bullets[i];
		bullet.x += bullet.vx * dt;
		bullet.y += bullet.vy * dt;
		bullet.life -= dt;
		if(bullet.life <= 0 || bullet.x < -40 || bullet.y < -40 || bullet.x > canvas.logicalWidth + 40 || bullet.y > canvas.logicalHeight + 40){
			bullets.splice(i, 1);
		}
	}
}

function updateEnemyProjectiles(dt){
	for(let i = enemyProjectiles.length - 1; i >= 0; i--){
		const projectile = enemyProjectiles[i];
		projectile.x += projectile.vx * dt;
		projectile.y += projectile.vy * dt;
		projectile.life -= dt;

		if(Math.hypot(projectile.x - player.x, projectile.y - player.y) < player.radius + projectile.radius){
			player.hp -= projectile.damage;
			addParticles(player.x, player.y, projectile.color || '#8fd3ff', 10);
			enemyProjectiles.splice(i, 1);
			if(player.hp <= 0){
				gameOver();
				return;
			}
			continue;
		}

		if(projectile.life <= 0 || projectile.x < -80 || projectile.y < -80 || projectile.x > canvas.logicalWidth + 80 || projectile.y > canvas.logicalHeight + 80){
			enemyProjectiles.splice(i, 1);
		}
	}
}

function updateEnemies(dt){
	for(let i = enemies.length - 1; i >= 0; i--){
		const enemy = enemies[i];
		if(enemy.type === 'auraMonster'){
			updateAuraMonster(enemy, i, dt);
			continue;
		}
		if(enemy.type === 'reinhard'){
			updateReinhard(enemy, i, dt);
			continue;
		}
		if(enemy.exploding){
			enemy.explosionTimer -= dt;
			if(enemy.explosionTimer <= 0){
				detonateBomber(enemy, i);
			}
			continue;
		}

		const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
		enemy.wobble += dt * 4;
		const weave = Math.sin(enemy.wobble) * (enemy.type === 'speed' ? 0.7 : 0.25);
		enemy.x += Math.cos(angle + weave) * enemy.speed * dt;
		enemy.y += Math.sin(angle + weave) * enemy.speed * dt;

		if(resolveEnemyPlayerCollision(enemy)){
			if(enemy.type === 'bomber'){
				armBomber(enemy);
				continue;
			}
			const now = performance.now();
			if(now - enemy.lastAttack >= enemy.attackCooldown * 1000){
				enemy.lastAttack = now;
				player.hp -= enemy.damage;
				addParticles(player.x, player.y, '#ff7979', 8);
				if(player.hp <= 0){
					gameOver();
					return;
				}
			}
		}

		if(enemy.type === 'healer'){
			enemy.healTimer += dt;
			if(enemy.healTimer >= 1.25){
				enemy.healTimer = 0;
				const ally = enemies.find((other) => other !== enemy && other.hp < other.maxHp && !other.isBoss);
				if(ally){
					ally.hp = Math.min(ally.maxHp, ally.hp + 4 + wave * 0.25);
					addParticles(ally.x, ally.y, '#89f7a1', 6);
				}
			}
		}

		if(hitEnemy(enemy, i)) return;
	}
}

function updateAuraMonster(enemy, index, dt){
	const reinhardActive = enemies.some((other) => other.type === 'reinhard');
	const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
	enemy.wobble += dt * 3;
	enemy.x += Math.cos(angle + Math.sin(enemy.wobble) * 0.15) * enemy.speed * dt;
	enemy.y += Math.sin(angle + Math.sin(enemy.wobble) * 0.15) * enemy.speed * dt;
	keepEnemyInArena(enemy);

	if(!reinhardActive){
		if(enemy.loop === 1){
			updateAuraLoopOne(enemy, dt);
		}else{
			updateAuraLoopTwo(enemy, dt);
		}
	}

	if(resolveEnemyPlayerCollision(enemy) && !reinhardActive){
		const now = performance.now();
		if(now - enemy.lastAttack >= enemy.attackCooldown * 1000){
			enemy.lastAttack = now;
			const dodged = enemy.loop === 1 && Math.random() < 0.45;
			if(dodged){
				addParticles(player.x, player.y, '#d8f2ff', 6);
				log('Esquivaste el golpe de Aura.');
			}else{
				player.hp -= enemy.damage;
				addParticles(player.x, player.y, '#ff7979', 8);
			}
		}
	}

	if(hitEnemy(enemy, index)) return;
	if(player.hp <= 0) gameOver();
}

function updateAuraLoopOne(enemy, dt){
	enemy.specialTimer -= dt;
	enemy.invisibleTimer -= dt;
	if(enemy.specialTimer <= 0){
		enemy.specialTimer = rand(1.6, 2.7);
		shootEnemyProjectile(enemy.x, enemy.y, player.x, player.y, 13, 190, 9, '#aeb1b7', 'rock');
	}
	if(enemy.hp < enemy.maxHp * 0.38 && enemy.invisibleTimer <= 0){
		enemy.invisibleTimer = 4.2;
		enemy.hp = Math.max(1, enemy.hp - enemy.maxHp * 0.05);
		player.hp -= enemy.damage * 1.12;
		addParticles(player.x, player.y, '#5d6cff', 18);
		log('Providencia invisible golpeó sin aviso.');
	}
}

function updateAuraLoopTwo(enemy, dt){
	enemy.whipTimer -= dt;
	enemy.invisibleTimer -= dt;
	enemy.beatriceTimer -= dt;
	enemy.beatriceMeleeTimer -= dt;
	enemy.beatriceSpriteTimer = Math.max(0, enemy.beatriceSpriteTimer - dt);

	if(enemy.whipTimer <= 0){
		enemy.whipTimer = 1.25;
		if(Math.hypot(enemy.x - player.x, enemy.y - player.y) < 120){
			player.hp -= enemy.damage * 1.2;
			addParticles(player.x, player.y, '#ffcf6b', 10);
			log('Aura conectó el látigo.');
		}
	}
	if(enemy.invisibleTimer <= 0){
		enemy.invisibleTimer = 3;
		player.hp -= enemy.damage * 1.8;
		addParticles(player.x, player.y, '#7e8bff', 20);
		log('Beatriz potenció Providencia invisible.');
	}
	if(enemy.beatriceMeleeTimer <= 0 && Math.hypot(enemy.x - player.x, enemy.y - player.y) < 58){
		enemy.beatriceMeleeTimer = 0.3;
		player.hp -= 32;
		addParticles(player.x, player.y, '#bdeaff', 8);
	}
	if(enemy.beatriceTimer <= 0){
		enemy.beatriceTimer = rand(3, 6);
		enemy.beatriceSpriteTimer = 0.65;
		spawnIceLine(enemy);
		log('Beatriz invocó cristales de hielo.');
	}
}

function updateReinhard(enemy, index, dt){
	const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
	enemy.dashTimer -= dt;
	enemy.spriteTimer = Math.max(0, enemy.spriteTimer - dt);
	if(enemy.spriteTimer <= 0) enemy.spriteState = 'idle';
	enemy.wobble += dt;
	if(enemy.dashTimer <= 0){
		enemy.dashTimer = 1.8;
		enemy.dashWindup = 0.22;
		enemy.spriteState = 'dash';
		enemy.spriteTimer = 0.42;
	}
	if(enemy.dashWindup > 0){
		enemy.dashWindup -= dt;
		if(enemy.dashWindup <= 0){
			enemy.x += Math.cos(angle) * 125;
			enemy.y += Math.sin(angle) * 125;
			enemy.spriteState = 'attack2';
			enemy.spriteTimer = 0.45;
			swordSweep(enemy, angle);
		}
	}else{
		enemy.x += Math.cos(angle) * enemy.speed * dt;
		enemy.y += Math.sin(angle) * enemy.speed * dt;
	}
	keepEnemyInArena(enemy);

	if(resolveEnemyPlayerCollision(enemy)){
		const now = performance.now();
		if(now - enemy.lastAttack >= enemy.attackCooldown * 1000){
			enemy.lastAttack = now;
			player.hp -= enemy.damage;
			addParticles(player.x, player.y, '#fff0a3', 20);
		}
	}

	if(hitEnemy(enemy, index)) return;
	if(player.hp <= 0) gameOver();
}

function keepEnemyInArena(enemy){
	enemy.x = clamp(enemy.x, enemy.radius, canvas.logicalWidth - enemy.radius);
	enemy.y = clamp(enemy.y, enemy.radius, canvas.logicalHeight - enemy.radius);
}

function shootEnemyProjectile(x, y, targetX, targetY, radius, speed, damage, color, kind){
	const angle = Math.atan2(targetY - y, targetX - x);
	enemyProjectiles.push({
		x,
		y,
		vx: Math.cos(angle) * speed,
		vy: Math.sin(angle) * speed,
		radius,
		damage,
		color,
		kind,
		life: 5
	});
}

function spawnIceLine(enemy){
	const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
	const side = angle + Math.PI / 2;
	for(let i = -2; i <= 2; i++){
		const x = player.x + Math.cos(side) * i * 26 - Math.cos(angle) * 120;
		const y = player.y + Math.sin(side) * i * 26 - Math.sin(angle) * 120;
		shootEnemyProjectile(x, y, player.x, player.y, 10, 245, 18, '#9be8ff', 'ice');
	}
}

function swordSweep(enemy, angle){
	const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
	if(distance < 145){
		player.hp -= enemy.damage;
		addParticles(player.x, player.y, '#fff0a3', 28);
		log('Reinhard cruzó el escenario con su espada.');
	}
	for(let i = 0; i < 16; i++){
		const spread = angle - 0.8 + i * 0.1;
		particles.push({
			x: enemy.x + Math.cos(spread) * 42,
			y: enemy.y + Math.sin(spread) * 42,
			vx: Math.cos(spread) * 120,
			vy: Math.sin(spread) * 120,
			color: '#fff0a3',
			life: 0.22,
			size: 4
		});
	}
}

function resolveEnemyPlayerCollision(enemy){
	const dx = enemy.x - player.x;
	const dy = enemy.y - player.y;
	const distance = Math.hypot(dx, dy);
	const minDistance = enemy.radius + player.radius;
	if(distance >= minDistance) return false;

	const nx = distance > 0 ? dx / distance : 1;
	const ny = distance > 0 ? dy / distance : 0;
	enemy.x = player.x + nx * minDistance;
	enemy.y = player.y + ny * minDistance;
	return true;
}

function hitEnemy(enemy, enemyIndex){
	if(enemy.exploding) return false;

	for(let j = bullets.length - 1; j >= 0; j--){
		const bullet = bullets[j];
		if(Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) >= enemy.radius + bullet.size * 0.55) continue;

		enemy.hp -= bullet.dmg;
		bullets.splice(j, 1);
		addParticles(bullet.x, bullet.y, enemyColor(enemy), 5);

		if(enemy.hp <= 0){
			killEnemy(enemy, enemyIndex);
		}
		return false;
	}
	return false;
}

function killEnemy(enemy, index){
	if(enemy.type === 'auraMonster'){
		handleAuraMonsterDeath(enemy, index);
		return;
	}
	if(enemy.type === 'reinhard'){
		handleReinhardDeath(enemy, index);
		return;
	}

	const xpGain = enemy.isBoss ? 30 + wave * 3 : Math.max(2, Math.floor(enemy.maxHp / 4));
	player.xp += xpGain;
	addParticles(enemy.x, enemy.y, enemyColor(enemy), enemy.isBoss ? 28 : 12);

	if(enemy.type === 'bomber'){
		armBomber(enemy);
		checkLevelUp();
		return;
	}

	if(false && enemy.type === 'bomber'){
		const explosionRadius = enemy.radius * 3.2;
		if(Math.hypot(player.x - enemy.x, player.y - enemy.y) < explosionRadius){
			player.hp -= Math.max(6, enemy.damage * 1.4);
			addParticles(player.x, player.y, '#ffb35c', 16);
			if(player.hp <= 0){
				gameOver();
				return;
			}
		}
		log('Un explosivo detonó cerca.');
	}

	if(enemy.isBoss || Math.random() < 0.22){
		createDrop(enemy.x, enemy.y, enemy.isBoss);
	}

	enemies.splice(index, 1);
	checkLevelUp();
}

function armBomber(enemy){
	if(enemy.exploding) return;
	enemy.exploding = true;
	enemy.explosionTimer = 1;
	enemy.explosionRadius = enemy.radius * 6;
	enemy.speed = 0;
	enemy.hp = Math.max(1, enemy.hp);
	addParticles(enemy.x, enemy.y, '#ffcf6b', 14);
	log('Explosivo armado.');
}

function detonateBomber(enemy, index){
	const explosionRadius = enemy.explosionRadius || enemy.radius * 6;
	addFireParticles(enemy.x, enemy.y, explosionRadius, 90);

	if(Math.hypot(player.x - enemy.x, player.y - enemy.y) < explosionRadius){
		player.hp -= Math.max(14, enemy.damage * 2.2);
		player.slowTimer = 10;
		player.slowMultiplier = 0.55;
		addParticles(player.x, player.y, '#ffb35c', 20);
		log('El kamikaze te ralentizó por 10s.');
	}

	enemies.splice(index, 1);

	if(player.hp <= 0){
		gameOver();
		return;
	}
}

function handleAuraMonsterDeath(enemy, index){
	addParticles(enemy.x, enemy.y, '#7e8bff', 34);
	if(enemy.loop === 1){
		const snapshot = auraFight && auraFight.startSnapshot ? auraFight.startSnapshot : captureFightSnapshot();
		restoreFightSnapshot(snapshot);
		spawnAuraMonsterFight(2);
		return;
	}

	player.xp += 90;
	createDrop(enemy.x, enemy.y, true);
	enemies.splice(index, 1);
	auraFight = null;
	bossSpawned = true;
	checkLevelUp();
	log('Aura Monster cayó en el segundo bucle.');
}

function handleReinhardDeath(enemy, index){
	addParticles(enemy.x, enemy.y, '#fff0a3', enemy.revivesLeft > 0 ? 45 : 70);
	if(enemy.revivesLeft > 0){
		enemy.revivesLeft--;
		enemy.hp = enemy.maxHp;
		enemy.x = canvas.logicalWidth - 90;
		enemy.y = 90;
		log('Reinhard resucitó.');
		return;
	}
	enemies.splice(index, 1);
	if(auraFight){
		auraFight.reinhardBanished = true;
		auraFight.reinhardReturnTimer = 40;
	}
	log('Reinhard fue enviado a la luna. Tienes 40s.');
}

function createDrop(x, y, strong = false){
	const stat = choose(upgradeStats);
	const roll = strong ? 0.98 : Math.random();
	let value = 1;
	let category = 'Baja';
	if(roll >= 0.95){
		value = 5;
		category = 'Alta';
	}else if(roll >= 0.7){
		value = 3;
		category = 'Media';
	}
	drops.push({ x, y, stat, value, category, radius: 13, ttl: 13 });
}

function updateDrops(dt){
	for(let i = drops.length - 1; i >= 0; i--){
		const drop = drops[i];
		drop.ttl -= dt;
		if(drop.ttl <= 0){
			drops.splice(i, 1);
			continue;
		}
		if(Math.hypot(drop.x - player.x, drop.y - player.y) < drop.radius + player.radius){
			applyDrop(drop);
			drops.splice(i, 1);
		}
	}
}

function applyDrop(drop){
	applyUpgrade(drop.stat, drop.value);
	log(`Mejora ${drop.category}: ${statName(drop.stat)} +${drop.value}`);
}

function checkLevelUp(){
	while(player.xp >= player.xpToNext){
		player.xp -= player.xpToNext;
		player.level++;
		player.xpToNext = Math.floor(player.xpToNext * 1.55 + player.level * 2);
		const stat = choose(upgradeStats);
		const value = choose([1, 1, 1, 2, 3]);
		applyUpgrade(stat, value);
		log(`Nivel ${player.level}: ${statName(stat)} +${value}`);
	}
}

function applyUpgrade(stat, value){
	if(stat === 'damage') player.damage += value;
	if(stat === 'maxHp'){
		player.maxHp += value * 10;
		player.hp = Math.min(player.maxHp, player.hp + value * 10);
	}
	if(stat === 'speed') player.speed += value * 8;
	if(stat === 'bulletSize'){
		player.bulletSize = Math.min(24, player.bulletSize + value * 0.9);
		player.bulletSpeed = Math.max(330, player.bulletSpeed - value * 22);
	}
	if(stat === 'fireCooldown') player.fireCooldown = Math.max(70, player.fireCooldown - value * 18);
}

function statName(stat){
	return {
		damage: 'Daño',
		maxHp: 'Vida máxima',
		speed: 'Velocidad',
		bulletSize: 'Crecimiento de bala',
		fireCooldown: 'Vel. disparo'
	}[stat];
}

function updateWave(dt){
	enemyTimer += dt;
	const spawnRate = Math.max(0.22, 0.62 - wave * 0.015);
	if(spawnCount > 0 && enemyTimer >= spawnRate){
		spawnCount--;
		spawnEnemy(false);
		enemyTimer = 0;
	}

	if(!wavePending && spawnCount === 0 && enemies.length === 0){
		if(wave === 20 && !bossSpawned){
			bossSpawned = true;
			spawnAuraMonsterFight(1);
		}else if(wave > 0 && wave % 10 === 0 && !bossSpawned){
			bossSpawned = true;
			log(`Jefe de la oleada ${wave}`);
			spawnEnemy(true);
		}else{
			wavePending = true;
			waveDelay = 0;
		}
	}

	if(wavePending){
		waveDelay += dt;
		if(waveDelay >= 1.1){
			spawnWave();
		}
	}
}

function updateAuraFight(dt){
	if(!auraFight || !auraFight.active) return false;
	if(auraFight.intro && auraFight.intro.active){
		updateReinhardIntro(dt);
		return true;
	}
	if(auraFight.loop !== 2 || !auraFight.reinhardBanished) return false;
	if(enemies.some((enemy) => enemy.type === 'reinhard')) return false;
	auraFight.reinhardReturnTimer -= dt;
	if(auraFight.reinhardReturnTimer <= 0 && enemies.some((enemy) => enemy.type === 'auraMonster')){
		auraFight.reinhardBanished = false;
		spawnReinhard();
		log('Reinhard volvió al campo.');
	}
	return false;
}

function updateReinhardIntro(dt){
	const intro = auraFight.intro;
	const line = intro.lines[intro.index];
	intro.timer += dt;
	intro.flash = Math.max(0, intro.flash - dt * 1.6);

	if(line.spawn && !intro.spawnedReinhard){
		intro.spawnedReinhard = true;
		intro.flash = 1;
		spawnReinhard();
		addFireParticles(canvas.logicalWidth - 90, 90, 120, 70);
	}

	if(intro.timer >= line.duration){
		intro.index++;
		intro.timer = 0;
		if(intro.index >= intro.lines.length){
			intro.active = false;
			auraFight.intro = null;
			log('Reinhard inició el combate.');
		}
	}
}

function updateParticles(dt){
	for(let i = particles.length - 1; i >= 0; i--){
		const particle = particles[i];
		particle.x += particle.vx * dt;
		particle.y += particle.vy * dt;
		particle.life -= dt;
		if(particle.life <= 0) particles.splice(i, 1);
	}
}

function addParticles(x, y, color, amount){
	for(let i = 0; i < amount; i++){
		const angle = rand(0, Math.PI * 2);
		const speed = rand(40, 160);
		particles.push({
			x, y,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			color,
			life: rand(0.18, 0.5),
			size: rand(2, 5)
		});
	}
}

function addFireParticles(x, y, radius, amount){
	const fireColors = ['#fff0a3', '#ffbd55', '#ff7438', '#d63b24'];
	for(let i = 0; i < amount; i++){
		const angle = rand(0, Math.PI * 2);
		const distance = Math.sqrt(Math.random()) * radius;
		const speed = rand(18, 130);
		particles.push({
			x: x + Math.cos(angle) * distance,
			y: y + Math.sin(angle) * distance,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed,
			color: choose(fireColors),
			life: rand(0.28, 0.85),
			size: rand(3, 9)
		});
	}
}

function updateUI(){
	waveEl.textContent = `Oleada: ${wave}`;
	levelEl.textContent = `Nivel: ${player.level}`;
	hpEl.textContent = `Vida: ${Math.max(0, Math.ceil(player.hp))}`;
	xpFill.style.width = `${Math.min(100, player.xp / player.xpToNext * 100)}%`;
	statsEl.innerHTML = `
		<span class="stat"><strong>Daño</strong>${player.damage.toFixed(1)}</span>
		<span class="stat"><strong>Vida</strong>${Math.ceil(player.maxHp)}</span>
		<span class="stat"><strong>Vel</strong>${Math.round(player.speed)}</span>
		<span class="stat"><strong>Bala</strong>${player.bulletSize.toFixed(1)} / ${Math.round(player.bulletSpeed)}</span>
		<span class="stat"><strong>Disp.</strong>${(1000 / player.fireCooldown).toFixed(1)}/s</span>
	`;
}

function resetGame(){
	resizeCanvas();
	player = createPlayer();
	bullets = [];
	enemyProjectiles = [];
	enemies = [];
	drops = [];
	particles = [];
	wave = 0;
	spawnCount = 0;
	enemyTimer = 0;
	wavePending = false;
	waveDelay = 0;
	bossSpawned = false;
	auraFight = null;
	paused = false;
	mouse.down = false;
	vJoy.x = 0;
	vJoy.y = 0;
	pauseBadge.classList.add('hidden');
	updateUI();
}

function setGameState(active){
	gameActive = active;
	document.body.classList.toggle('game-active', active);
	document.getElementById('startScreen').classList.toggle('active', !active);
	document.getElementById('startScreen').classList.toggle('hidden', active);
	document.getElementById('deathScreen').classList.add('hidden');
}

function togglePause(){
	paused = !paused;
	pauseBadge.classList.toggle('hidden', !paused);
	log(paused ? 'Pausa activada.' : 'Pausa desactivada.');
}

function gameOver(){
	gameActive = false;
	paused = false;
	mouse.down = false;
	vJoy.x = 0;
	vJoy.y = 0;
	enemyProjectiles = [];
	auraFight = null;
	document.body.classList.remove('game-active');
	pauseBadge.classList.add('hidden');
	document.getElementById('deathText').textContent = `Llegaste a la oleada ${wave} y al nivel ${player.level}.`;
	document.getElementById('deathScreen').classList.remove('hidden');
	log('Perdiste. Puedes reintentar.');
}

function draw(){
	const width = canvas.logicalWidth;
	const height = canvas.logicalHeight;
	ctx.clearRect(0, 0, width, height);
	drawBackground(width, height);
	if(!player) return;
	drawDrops();
	drawBullets();
	drawEnemyProjectiles();
	drawEnemies();
	drawParticles();
	drawPlayer();
	drawAuraDialogue();
}

function drawBackground(width, height){
	ctx.fillStyle = '#0b1118';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = 'rgba(255,255,255,0.045)';
	ctx.lineWidth = 1;
	for(let x = 0; x < width; x += 42){
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}
	for(let y = 0; y < height; y += 42){
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
}

function drawPlayer(){
	const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
	ctx.save();
	ctx.translate(player.x, player.y);
	ctx.rotate(angle + Math.PI / 2);
	ctx.fillStyle = '#f6f8fb';
	fillRoundRect(-3, -player.radius - 23, 6, 30, 3);
	ctx.fillStyle = '#f28b45';
	fillRoundRect(-2, -player.radius - 21, 4, 22, 2);
	drawRoundedSprite(sprites.player, -player.radius * 1.45, -player.radius * 1.45, player.radius * 2.9, player.radius * 2.9, 8, '#8fd3ff');
	ctx.restore();

	drawHealthBar(player.x, player.y - 26, 42, 6, player.hp / player.maxHp, '#7bdc79');
}

function drawBullets(){
	for(const bullet of bullets){
		ctx.save();
		ctx.translate(bullet.x, bullet.y);
		ctx.rotate(bullet.angle);
		drawOvalSprite(sprites.bullet, -bullet.size, -bullet.size, bullet.size * 2, bullet.size * 2, '#f8cf72');
		ctx.restore();
	}
}

function drawEnemyProjectiles(){
	for(const projectile of enemyProjectiles){
		ctx.save();
		ctx.translate(projectile.x, projectile.y);
		ctx.fillStyle = projectile.color || '#ffcf6b';
		if(projectile.kind === 'rock'){
			// intentar dibujar roca como sprite, si no usar rectángulo rotado
			ctx.rotate(performance.now() / 220);
			drawOvalSprite(sprites.subaruRock, -projectile.radius, -projectile.radius, projectile.radius * 2, projectile.radius * 2, projectile.color || '#aeb1b7');
		}else if(projectile.kind === 'ice'){
			// dibujar proyectil de hielo como sprite de Beatrice si está disponible
			drawRoundSprite(sprites.beatriceIce, -projectile.radius, -projectile.radius, projectile.radius * 2, projectile.radius * 2, '#9be8ff');
		}else{
			ctx.beginPath();
			ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
}

function drawDrops(){
	for(const drop of drops){
		ctx.fillStyle = drop.category === 'Alta' ? '#f2c866' : drop.category === 'Media' ? '#86e6bc' : '#8fb5ff';
		ctx.beginPath();
		ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#061016';
		ctx.font = '700 11px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(symbolFor(drop.stat), drop.x, drop.y + 0.5);
	}
}

function drawEnemies(){
	for(const enemy of enemies){
		const size = enemy.radius * (enemy.isBoss ? 2.75 : 2.35);
		if(enemy.exploding){
			drawExplosionWarning(enemy);
		}

		ctx.save();
		ctx.translate(enemy.x, enemy.y);
		if(enemy.type === 'speed'){
			const tilt = Math.sin(enemy.wobble * 2) * 0.12;
			ctx.rotate(tilt);
		}
		if(enemy.type === 'tank'){
			ctx.globalAlpha = 0.88;
			ctx.scale(1.15, 1.15);
		}
		if(enemy.type === 'bomber'){
			const pulse = enemy.exploding ? 1 + Math.sin(performance.now() / 75) * 0.08 : 1;
			ctx.scale(pulse, pulse);
			drawOvalSprite(sprites.bomber, -size / 2, -size / 2, size, size * 1.12, enemyColor(enemy));
		}else if(enemy.type === 'speed' || enemy.type === 'healer'){
			drawRoundSprite(sprites[enemy.type], -size / 2, -size / 2, size, size, enemyColor(enemy));
		}else if(enemy.type === 'auraMonster'){
			drawAuraMonster(enemy, size);
		}else if(enemy.type === 'reinhard'){
			drawReinhard(enemy, size);
		}else{
			drawSprite(sprites[enemy.type], -size / 2, -size / 2, size, size, enemyColor(enemy));
		}
		ctx.restore();
		drawHealthBar(enemy.x, enemy.y - enemy.radius - 10, enemy.radius * 2, 5, enemy.hp / enemy.maxHp, '#7bdc79');
	}
}

function drawReinhard(enemy, size){
	const sprite = enemy.spriteState === 'attack2'
		? sprites.reinhardAttack2
		: enemy.spriteState === 'dash'
			? sprites.reinhardDash
			: sprites.reinhard;
	drawRoundedSprite(sprite, -size / 2, -size / 2, size, size, 8, enemyColor(enemy));
	if(enemy.spriteState === 'attack2'){
		ctx.save();
		ctx.rotate(Math.sin(performance.now() / 75) * 0.35);
		drawRoundedSprite(sprites.reinhardSword, -size * 0.1, -size * 0.85, size * 0.24, size * 1.28, 4, '#fff0a3');
		ctx.restore();
	}
}

function drawAuraMonster(enemy, size){
	const sprite = enemy.loop === 1 ? sprites.auraMonster : getSubaruSprite(enemy);
	drawRoundedSprite(sprite, -size / 2, -size / 2, size, size, 9, enemyColor(enemy));
	if(enemy.loop === 2){
		const bob = Math.sin(performance.now() / 240) * 4;
		const beakoSprite = enemy.beatriceSpriteTimer > 0 ? sprites.beatriceIce : sprites.beatrice;
		drawRoundedSprite(beakoSprite, size * 0.08, -size * 0.56 + bob, size * 0.58, size * 0.58, 8, '#bdeaff');
	}
}

function getSubaruSprite(enemy){
	if(enemy.whipTimer > 0.95) return sprites.subaruWhip;
	if(enemy.specialTimer > 1.25) return sprites.subaruRock;
	return sprites.subaru;
}

function drawAuraDialogue(){
	if(!auraFight || !auraFight.intro || !auraFight.intro.active) return;
	const intro = auraFight.intro;
	const line = intro.lines[intro.index];
	if(intro.flash > 0){
		ctx.save();
		ctx.globalAlpha = intro.flash * 0.72;
		ctx.fillStyle = '#fff8b7';
		ctx.fillRect(0, 0, canvas.logicalWidth, canvas.logicalHeight);
		ctx.restore();
	}

	const boxWidth = Math.min(canvas.logicalWidth - 28, 720);
	const boxHeight = line.shout ? 112 : 128;
	const x = (canvas.logicalWidth - boxWidth) / 2;
	const y = canvas.logicalHeight - boxHeight - 22;
	ctx.save();
	ctx.globalAlpha = 0.94;
	ctx.fillStyle = 'rgba(8,12,18,0.92)';
	fillRoundRect(x, y, boxWidth, boxHeight, 8);
	ctx.globalAlpha = 1;
	ctx.fillStyle = line.speaker === 'Reinhard' ? '#fff0a3' : '#9be8ff';
	ctx.font = '800 15px Arial';
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillText(line.speaker, x + 18, y + 14);
	ctx.fillStyle = '#f8fbff';
	ctx.font = line.shout ? '900 28px Arial' : '700 18px Arial';
	wrapText(line.text, x + 18, y + 42, boxWidth - 36, line.shout ? 34 : 25);
	ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight){
	const words = text.split(' ');
	let line = '';
	for(const word of words){
		const testLine = line ? `${line} ${word}` : word;
		if(ctx.measureText(testLine).width > maxWidth && line){
			ctx.fillText(line, x, y);
			line = word;
			y += lineHeight;
		}else{
			line = testLine;
		}
	}
	if(line) ctx.fillText(line, x, y);
}

function drawExplosionWarning(enemy){
	const radius = enemy.explosionRadius || enemy.radius * 6;
	const progress = clamp(enemy.explosionTimer, 0, 1);
	const pulse = 0.5 + Math.sin(performance.now() / 80) * 0.18;

	ctx.save();
	ctx.globalAlpha = 0.18 + (1 - progress) * 0.18;
	ctx.fillStyle = '#ff6d3a';
	ctx.beginPath();
	ctx.arc(enemy.x, enemy.y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 0.65 + pulse * 0.2;
	ctx.strokeStyle = '#ffcf6b';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(enemy.x, enemy.y, radius, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function drawSprite(image, x, y, width, height, fallbackColor){
	if(image.complete && image.naturalWidth > 0){
		ctx.drawImage(image, x, y, width, height);
		return;
	}
	ctx.fillStyle = fallbackColor;
	ctx.beginPath();
	ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
	ctx.fill();
}

function fillRoundRect(x, y, width, height, radius){
	roundedRectPath(x, y, width, height, radius);
	ctx.fill();
}

function roundedRectPath(x, y, width, height, radius){
	const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + width - r, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r);
	ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

function drawRoundedSprite(image, x, y, width, height, radius, fallbackColor){
	ctx.save();
	roundedRectPath(x, y, width, height, radius);
	ctx.clip();
	drawSprite(image, x, y, width, height, fallbackColor);
	ctx.restore();
}

function drawRoundSprite(image, x, y, width, height, fallbackColor){
	const radius = Math.min(width, height) / 2;
	ctx.save();
	ctx.beginPath();
	ctx.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
	ctx.clip();
	drawSprite(image, x, y, width, height, fallbackColor);
	ctx.restore();
}

function drawOvalSprite(image, x, y, width, height, fallbackColor){
	ctx.save();
	ctx.beginPath();
	ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
	ctx.clip();
	drawSprite(image, x, y, width, height, fallbackColor);
	ctx.restore();
}

function drawParticles(){
	for(const particle of particles){
		ctx.globalAlpha = Math.max(0, particle.life * 2);
		ctx.fillStyle = particle.color;
		ctx.beginPath();
		ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

function drawHealthBar(x, y, width, height, ratio, color){
	ctx.fillStyle = 'rgba(0,0,0,0.48)';
	ctx.fillRect(x - width / 2, y, width, height);
	ctx.fillStyle = color;
	ctx.fillRect(x - width / 2, y, width * clamp(ratio, 0, 1), height);
}

function enemyColor(enemy){
	return {
		normal: '#7bdc79',
		bomber: '#ffad5c',
		speed: '#63cdf4',
		tank: '#c985ff',
		healer: '#90f5aa',
		boss: '#ff6d78',
		auraMonster: '#7e8bff',
		reinhard: '#fff0a3'
	}[enemy.type] || '#7bdc79';
}

function symbolFor(stat){
	return {
		damage: 'D',
		maxHp: 'HP',
		speed: 'V',
		bulletSize: 'B',
		fireCooldown: 'R'
	}[stat];
}

let last = performance.now();
function loop(now){
	const dt = Math.min(0.05, (now - last) / 1000);
	update(dt);
	draw();
	last = now;
	requestAnimationFrame(loop);
}

function startGame(){
	resetGame();
	setGameState(true);
	if(forceBossTest){
		wave = 20;
		waveEl.textContent = `Oleada: ${wave}`;
		bossSpawned = false;
		spawnAuraMonsterFight(1);
	}else{
		spawnWave();
	}
}

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('retryButton').addEventListener('click', startGame);

resetGame();
setGameState(false);
requestAnimationFrame(loop);