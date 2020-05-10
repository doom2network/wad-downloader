import fs from 'fs'
import fetch, { Response } from 'node-fetch'
import cheerio from 'cheerio'
import { union } from './helpers'
import util from 'util'
import { pipeline } from 'stream'
import path from 'path'
import clear from 'clear'

const streamPipeline = util.promisify(pipeline)

async function getPage(url: string): Promise<string> {
    const res = await fetch(url)
    const text = await res.text()
    return text
}

async function buildDownloadLinks(baseUrl: string) {

    interface PageLinks {
        folderLinks: Set<string>,
        downloadLinks: Set<string>
    }

    async function getPageLinks(url: string): Promise<PageLinks> {

        const folderLinks: Set<string>  = new Set()
        const downloadLinks: Set<string> = new Set()

        const body = await getPage(url)
        const $ = cheerio.load(body)

        $('a').each((index, elem) => {
            const text = $(elem).text()

            if (text.endsWith('/')) {
                folderLinks.add(`${url}/${$(elem).attr().href}`)
            }

            if (text.toUpperCase().endsWith('.ZIP') || text.toUpperCase().endsWith('.WAD')) {
                downloadLinks.add(`${url}${$(elem).attr().href}`)
            }

        });

        return { folderLinks, downloadLinks }
    }

    let allFolderLinks: Set<string> = new Set()
    let allDownloadLinks: Set<string> = new Set()

    const { folderLinks } = await getPageLinks(baseUrl)

    const promises: Promise<PageLinks>[] = []

    folderLinks.forEach(link => {
        promises.push(getPageLinks(<string>link))
    })

    const results = await Promise.all(promises)

    // Add the results to the allFolderLinks and allDownloadLinks sets
    results.forEach(result => {
        allFolderLinks = union(allFolderLinks, result.folderLinks)
        allDownloadLinks = union(allDownloadLinks, result.downloadLinks)
    })
    return allDownloadLinks
}

async function downloadFile(url:string, to:string) {

    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetch(url)
            if (!res.ok) {
                reject(`Unexpected response ${res.statusText}`)
            }
            await streamPipeline(res.body, fs.createWriteStream(to))
            resolve(to)
        } catch (error) {
            reject(error)
        }
    })

}

async function main(args:any) {

    const baseUrls = [
        'https://youfailit.net/pub/idgames/levels/doom',
        'https://youfailit.net/pub/idgames/levels/doom2'
    ]

    const { STORAGE_PATH } = args

    if (!STORAGE_PATH) {
        throw new Error('STORAGE_PATH environment variable is not set')
    }

    const baseUrl = baseUrls[0]
    const links = await buildDownloadLinks(baseUrl)

    for await(let link of links) {
        clear()
        const fp = path.resolve(STORAGE_PATH, path.basename(link))
        console.log(`Downloading ${path.basename(fp)} 💿`)
        await downloadFile(link, fp)
    }
}

main(process.env)
