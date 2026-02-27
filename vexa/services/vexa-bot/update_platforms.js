const fs = require('fs');
const path = require('path');

function updatePlatform(filepath) {
    let content = fs.readFileSync(filepath, 'utf-8');

    // 1. Replace WhisperLiveService import with DeepgramService
    content = content.replace(
        'import { WhisperLiveService } from "../../services/whisperlive";',
        'import { DeepgramService } from "../../services/deepgram";'
    );

    // 2. Replace WhisperLiveService initializations
    // Find: let whisperLiveService: WhisperLiveService | null = null;
    content = content.replace(/let whisperLiveService:\s*WhisperLiveService\s*\|\s*null\s*=\s*null;/, 'let deepgramService: DeepgramService | null = null;');
    // Find let whisperLiveUrl: string | null = null;
    content = content.replace(/let whisperLiveUrl:\s*string\s*\|\s*null\s*=\s*null;/, 'let deepgramApiKey: string | null = null;');

    // 3. Replace initialization block
    // We'll use a regex to match the old init block
    const oldInitRegex = /if\s*\(transcriptionEnabled\)\s*\{\s*whisperLiveService\s*=\s*new\s*WhisperLiveService[^}]*\}\);\s*\/\/[^\n]*\n\s*whisperLiveUrl[^;]*;\s*log\(`\[Node\.js\] Using WhisperLive[^`]*`\);\s*\}/s;

    // Extract platform name if possible
    let platform = "Browser Platform";
    if (filepath.includes("googlemeet")) platform = "Google Meet";
    if (filepath.includes("msteams")) platform = "Teams";

    const newInit = `if (transcriptionEnabled) {
    deepgramService = new DeepgramService({
      deepgramApiKey: process.env.DEEPGRAM_API_KEY
    });
    await deepgramService.initialize();
    deepgramApiKey = process.env.DEEPGRAM_API_KEY || null;
    log(\`[Node.js] Using Deepgram directly for ${platform}\`);
  }`;

    if (oldInitRegex.test(content)) {
        content = content.replace(oldInitRegex, newInit);
    } else {
        console.log("Could not find initialization block in", filepath);
    }

    // Expose the Redis push function
    if (content.includes('await page.exposeFunction("__vexaSaveRecordingBlob"')) {
        const insertionPt = content.indexOf('await page.exposeFunction("__vexaSaveRecordingBlob"');

        const exposeRedis = `
    await page.exposeFunction("vexa_pushTranscriptToRedis", async (uid: string, segment: any, botConfigData: any) => {
      try {
        if (deepgramService) {
          // Access the private pushToRedis method by invoking it with cast
          await (deepgramService as any).pushToRedis(segment, botConfigData);
        }
      } catch (err: any) {
        log(\`[Node.js] Error pushing browser transcript to Redis: \${err.message}\`);
      }
    });

    `;
        content = content.substring(0, insertionPt) + exposeRedis + content.substring(insertionPt);
    }

    // 4. Update pageArgs interface to take deepgramApiKey instead of whisperUrlForBrowser
    content = content.replace(/whisperUrlForBrowser:\s*string\s*\|\s*null;/g, 'deepgramApiKeyForBrowser: string | null;');

    // 5. Update destructured pageArgs
    content = content.replace('const { botConfigData, whisperUrlForBrowser, selectors } = pageArgs;', 'const { botConfigData, deepgramApiKeyForBrowser, selectors } = pageArgs;');

    // 6. Update BrowserWhisperLiveService destructoring
    content = content.replace('const { BrowserAudioService, BrowserWhisperLiveService } = (window as any).VexaBrowserUtils;', 'const { BrowserAudioService, BrowserDeepgramService } = (window as any).VexaBrowserUtils;');

    // 7. Update browser service instantiation
    content = content.replace('const whisperLiveService = transcriptionEnabled', 'const deepgramService = transcriptionEnabled');

    const oldBrowserInit = `new browserUtils.BrowserWhisperLiveService({
            whisperLiveUrl: whisperUrlForBrowser as string
          }, true)`;
    const newBrowserInit = `new browserUtils.BrowserDeepgramService({
            deepgramApiKey: deepgramApiKeyForBrowser as string
          }, true)`;
    content = content.replace(oldBrowserInit, newBrowserInit);

    const oldTeamsBrowserInit = `new BrowserWhisperLiveService({
            whisperLiveUrl: whisperUrlForBrowser as string
          }, true)`;
    const newTeamsBrowserInit = `new BrowserDeepgramService({
            deepgramApiKey: deepgramApiKeyForBrowser as string
          }, true)`;
    content = content.replace(oldTeamsBrowserInit, newTeamsBrowserInit);

    // 8. Replace global references
    content = content.replace(/__vexaWhisperLiveService\s*=\s*whisperLiveService/g, '__vexaDeepgramService = deepgramService');
    content = content.replace(/__vexaWhisperLiveService/g, '__vexaDeepgramService');
    content = content.replace(/whisperLiveService/g, 'deepgramService');

    // 9. Fix connectToWhisperLive -> connectToDeepgram
    content = content.replace(/connectToWhisperLive/g, 'connectToDeepgram');

    // 10. Update the page.evaluate arguments passed from Node.js
    content = content.replace(/whisperUrlForBrowser:\s*whisperLiveUrl/g, 'deepgramApiKeyForBrowser: deepgramApiKey');

    // 11. Rename connectWhisper to connectDeepgram if it exists
    content = content.replace(/connectWhisper/g, 'connectDeepgram');

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log("Updated", filepath);
}

try {
    updatePlatform(path.join(__dirname, 'core/src/platforms/googlemeet/recording.ts'));
    updatePlatform(path.join(__dirname, 'core/src/platforms/msteams/recording.ts'));
} catch (e) {
    console.error(e);
}
