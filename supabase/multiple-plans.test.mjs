// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const migration = name => readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8')
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE tenants(id UUID PRIMARY KEY, status TEXT DEFAULT 'active');
    CREATE TABLE profiles(id UUID PRIMARY KEY, tenant_id UUID, role TEXT, active BOOLEAN DEFAULT true, UNIQUE(id,tenant_id));
    CREATE TABLE clients(id UUID PRIMARY KEY, tenant_id UUID, profile_id UUID, active BOOLEAN DEFAULT true, UNIQUE(id,tenant_id));
    CREATE TABLE training_exercise_library(id UUID PRIMARY KEY);
  `)
  const original = await migration('010_reminders_training.sql')
  await db.exec(original.slice(original.indexOf('CREATE TABLE training_plans'), original.indexOf('CREATE FUNCTION training_session_write')))
  for (const file of ['011_training_progress_ai.sql', '013_nutrition_plans.sql', '014_training_weight_history.sql', '015_training_isometry.sql']) {
    await db.exec(await migration(file))
  }
  await db.exec(`
    INSERT INTO tenants(id) VALUES('${id(1)}'),('${id(2)}');
    INSERT INTO profiles(id,tenant_id,role) VALUES('${id(10)}','${id(1)}','CLIENT'),('${id(11)}','${id(1)}','TENANT_ADMIN'),('${id(12)}','${id(2)}','CLIENT');
    INSERT INTO clients(id,tenant_id,profile_id) VALUES('${id(20)}','${id(1)}','${id(10)}'),('${id(21)}','${id(2)}','${id(12)}');
    INSERT INTO training_plans(id,tenant_id,client_id,professional_id,title,exercises)
      VALUES('${id(30)}','${id(1)}','${id(20)}','${id(11)}','A','[{"id":"${id(40)}","name":"Squat"}]');
    INSERT INTO nutrition_plans(id,tenant_id,client_id,professional_id,title) VALUES('${id(50)}','${id(1)}','${id(20)}','${id(11)}','Piano precedente');
    INSERT INTO training_access(client_id,tenant_id,token_hash,expires_at) VALUES('${id(20)}','${id(1)}','token-test',now()+interval '1 day');
  `)
  await db.exec(await migration('016_multiple_client_plans.sql'))
  await db.exec(`
    INSERT INTO training_plans(id,tenant_id,client_id,professional_id,title,exercises)
      VALUES('${id(31)}','${id(1)}','${id(20)}','${id(11)}','B','[{"id":"${id(41)}","name":"Plank"}]');
    INSERT INTO nutrition_plans(id,tenant_id,client_id,professional_id,title,starts_on,ends_on,initial_measurements,final_measurements)
      VALUES('${id(51)}','${id(1)}','${id(20)}','${id(11)}','Nuovo piano','2026-10-19','2026-11-19','{"weightKg":80}','{"weightKg":78}');
  `)
  const query = async (sql, params = []) => (await db.query(sql, params)).rows
  assert.equal((await query('SELECT * FROM nutrition_plans')).length, 2)
  assert.equal((await query('SELECT starts_on FROM nutrition_plans WHERE id=$1', [id(50)]))[0].starts_on, null)
  await assert.rejects(db.exec(`UPDATE nutrition_plans SET ends_on='2026-10-01' WHERE id='${id(51)}'`))
  await assert.rejects(db.query("SELECT portal_training_session_write(p_user=>$1,p_action=>'start',p_plan_id=>$2)", [id(12), id(31)]))
  await assert.rejects(db.query("SELECT portal_training_session_write(p_user=>$1,p_action=>'start',p_plan_id=>$2)", [id(11), id(31)]))
  const [result] = await query("SELECT portal_training_session_write(p_user=>$1,p_action=>'start',p_plan_id=>$2) AS s", [id(10), id(31)])
  assert.equal(result.s.plan_snapshot.id, id(31))
  const [again] = await query("SELECT training_session_write(p_hash=>'token-test',p_action=>'start',p_plan_id=>$1) AS s", [id(31)])
  assert.equal(again.s.id, result.s.id)
  await assert.rejects(db.query("SELECT training_session_write(p_hash=>'token-test',p_action=>'start',p_plan_id=>$1)", [id(30)]))
  const entries = [{ exerciseId: id(41), sets: [{ weightKg: 20, reps: 8 }] }]
  const [saved] = await query("SELECT portal_training_session_write($1,'save',$2,1,$3,$4,'') AS s", [id(10), result.s.id, JSON.stringify(entries), id(60)])
  assert.equal(saved.s.version, 2)
  entries[0].sets[0].weightKg = 30
  const [completed] = await query("SELECT training_session_write('token-test','complete',$1,2,$2,$3,'') AS s", [result.s.id, JSON.stringify(entries), id(61)])
  assert.equal(completed.s.weight_history.at(-1).previousKg, 20)
  assert.equal(completed.s.weight_history.at(-1).weightKg, 30)
  await db.exec(`UPDATE training_plans SET title='B cambiata' WHERE id='${id(31)}'`)
  assert.equal((await query('SELECT plan_snapshot FROM training_sessions WHERE id=$1', [result.s.id]))[0].plan_snapshot.title, 'B')
  const [next] = await query("SELECT portal_training_session_write(p_user=>$1,p_action=>'start',p_plan_id=>$2) AS s", [id(10), id(30)])
  assert.equal(next.s.plan_snapshot.id, id(30))
  const [permission] = await query("SELECT has_function_privilege('authenticated','start_client_training(uuid,uuid,uuid)','EXECUTE') AS allowed")
  assert.equal(permission.allowed, false)
  await db.exec("UPDATE training_access SET revoked_at=now()")
  await assert.rejects(db.query("SELECT training_session_write(p_hash=>'token-test',p_action=>'start',p_plan_id=>$1)", [id(30)]))
  console.log('PASS: migration preserves old plans, multiple plans, date bounds, role/client isolation, selected plan, shared open session, saved weight history, immutable snapshots, revoked links and function permissions')
} finally {
  await db.close()
}
