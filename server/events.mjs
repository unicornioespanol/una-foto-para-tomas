import { z } from 'zod';
const code=z.string().regex(/^[a-zA-Z0-9_.:-]{1,90}$/),uuid=z.string().uuid(),ms=z.number().int().min(0).max(86400000),route=z.enum(['photo','drawing']).nullable(),ending=z.enum(['song','story']).nullable();
const task={task_id:code,task_instance_id:uuid};const playback={audio_play_id:uuid};
const definitions={
 session_started:{entry_page:code,entry_phase:code},
 page_entered:{page_visit_id:uuid,phase:code,route,navigation_reason:code},
 page_activity:{page_visit_id:uuid,active_delta_ms:ms,visible_delta_ms:ms,interval_id:uuid},
 page_exited:{page_visit_id:uuid,reason:code},
 audio_started:{...playback,segment_id:code.nullable(),page_id:code,source:z.enum(['tts','file']),rate:z.number().min(.5).max(2),voice_lang:z.string().regex(/^[a-zA-Z_-]{2,20}$/)},
 audio_paused:{...playback,reason:code,played_delta_ms:ms},audio_stopped:{...playback,reason:code,played_delta_ms:ms},audio_ended:{...playback,reason:code,played_delta_ms:ms},
 audio_repeated:{...playback,previous_play_id:uuid.nullable(),scope:z.enum(['page','segment'])},audio_error:{code:z.enum(['unsupported','voice-unavailable','network','start-timeout','speech-error'])},
 choice_shown:{choice_visit_id:uuid,choice_set_id:code},choice_selected:{choice_visit_id:uuid,choice_id:code,route:route.optional(),ending:ending.optional(),decision_active_ms:ms},
 task_started:{...task,route},task_answered:{...task,item_id:code,answer_id:code.optional(),answer_ids:z.array(code).max(10).optional(),input_method:z.enum(['keyboard','pointer','touch','accessible-button'])},
 task_checked:{...task,attempt_index:z.number().int().min(1).max(10000),incorrect_item_ids:z.array(code).max(20),correct_count:z.number().int().min(0).max(20),total_count:z.number().int().min(1).max(20)},
 task_completed:{...task,attempts:z.number().int().min(0).max(10000),hint_count:z.number().int().min(0).max(10000),active_ms:ms},
 hint_used:{task_instance_id:uuid,page_visit_id:uuid,hint_id:code},prediction_selected:{option_id:code,stage:z.enum(['before','after'])},
 album_saved:{place_id:z.enum(['jardin','cocina','salon']),object_id:z.enum(['gato','guitarra','pelota']),activity_id:code},
 story_completed:{route,ending,ordered_page_ids:z.array(code).length(9),run_active_ms:ms}
};
export const eventNames=Object.keys(definitions);
const envelope=z.object({event_id:uuid,event_schema_version:z.literal(1),book_id:z.literal('una-foto-para-tomas'),content_version:z.literal('approved-2026-10-22-v1'),participant_id:uuid,session_id:uuid,run_id:uuid,consent_id:uuid,event:z.enum(eventNames),client_ts:z.string().datetime(),sequence:z.number().int().min(1).max(2147483647),page_id:code.nullable(),step_id:code.nullable(),payload:z.record(z.string(),z.unknown())}).strict();
export function validateEvent(raw){const e=envelope.parse(raw);e.payload=z.object(definitions[e.event]).strict().parse(e.payload);return e}
