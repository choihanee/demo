import { readForm } from './formReader.js'
import { generate } from '../engine/generator.js'
import { submitForm } from './formSubmitter.js'

const form = await readForm('https://docs.google.com/forms/d/e/1FAIpQLSe0qQFVBjvmJpYHH_I8Dalb2Y-VmB06kSv8T4rlXu5N_HRSCg/viewform')
console.log(form.sections.map(s => `${s.id} → ${s.next}`))