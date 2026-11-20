import { readForm } from './formReader.js'

const url = '여기에 복사한 viewform 링크'
const result = await readForm('https://docs.google.com/forms/d/e/1FAIpQLSdo0ES8XnrAEon01qvgCfo0d3ai2ERTfr0CP3fKm0tfnuJbIg/viewform')
console.log(JSON.stringify(result, null, 2))