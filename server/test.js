import { readForm } from './formReader.js'
import { generate } from '../engine/generator.js'
import { submitForm } from './formSubmitter.js'

const form = await readForm('https://docs.google.com/forms/d/e/1FAIpQLSdo0ES8XnrAEon01qvgCfo0d3ai2ERTfr0CP3fKm0tfnuJbIg/viewform')
const result = generate(form, { total: 1, attributes: {} }, [], [], { seed: 1 })
console.log(await submitForm(form, result.rows))