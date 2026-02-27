import os
import re

def update_platform(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Replace WhisperLiveService import with DeepgramService
    content = content.replace(
        'import { WhisperLiveService } from "../../services/whisperlive";',
        'import { DeepgramService } from "../../services/deepgram";'
    )
    
    # 2. Replace WhisperLiveService initializations
    content = content.replace(
        'let whisperLiveService: WhisperLiveService | null = null;',
        'let deepgramService: DeepgramService | null = null;'
    )
    content = content.replace(
        'let whisperLiveUrl: string | null = null;',
        'let deepgramApiKey: string | null = process.env.DEEPGRAM_API_KEY || null;'
    )
    
    # 3. Replace initialization block
    old_init = """  if (transcriptionEnabled) {
    whisperLiveService = new WhisperLiveService({
      whisperLiveUrl: process.env.WHISPER_LIVE_URL
    });
    // Initialize WhisperLive connection with STUBBORN reconnection - NEVER GIVES UP!
    whisperLiveUrl = await whisperLiveService.initializeWithStubbornReconnection("""
    
    new_init = """  if (transcriptionEnabled) {
    deepgramService = new DeepgramService({
      deepgramApiKey: process.env.DEEPGRAM_API_KEY
    });
    await deepgramService.initialize();
    log(`[Node.js] Using Deepgram directly for"""
    
    if old_init in content:
        # Find the end of the initialize call
        start_idx = content.find(old_init)
        if start_idx != -1:
            end_idx = content.find(');', start_idx) + 2
            next_line_end = content.find('\\n', end_idx) + 1
            log_line_end = content.find('\\n', next_line_end) + 1
            
            # The platform name is inside initializeWithStubbornReconnection("Google Meet")
            platform_match = re.search(r'initializeWithStubbornReconnection\("([^"]+)"\)', content[start_idx:end_idx])
            platform = platform_match.group(1) if platform_match else "Browser Platform"
            
            replacement = f"""  if (transcriptionEnabled) {{
    deepgramService = new DeepgramService({{
      deepgramApiKey: process.env.DEEPGRAM_API_KEY
    }});
    await deepgramService.initialize();
    log(`[Node.js] Initialized Deepgram for {platform}`);
"""
            content = content[:start_idx] + replacement + content[log_line_end:]
    
    # Expose the Redis push function
    if "await page.exposeFunction(\\\"__vexaSaveRecordingBlob\\\"" in content:
        insertion_pt = content.find("await page.exposeFunction(\\\"__vexaSaveRecordingBlob\\\"")
        
        expose_redis = """    await page.exposeFunction("vexa_pushTranscriptToRedis", async (uid: string, segment: any, botConfigData: any) => {
      try {
        if (deepgramService) {
          // Access the private pushToRedis method by invoking it with cast
          await (deepgramService as any).pushToRedis(segment, botConfigData);
        }
      } catch (err: any) {
        log(`[Node.js] Error pushing browser transcript to Redis: ${err.message}`);
      }
    });

    """
        content = content[:insertion_pt] + expose_redis + content[insertion_pt:]
    
    # 4. Update pageArgs interface to take deepgramApiKey instead of whisperUrlForBrowser
    content = content.replace(
        'whisperUrlForBrowser: string | null;',
        'deepgramApiKeyForBrowser: string | null;'
    )
    
    # 5. Update destructured pageArgs
    content = content.replace(
        'const { botConfigData, whisperUrlForBrowser, selectors } = pageArgs;',
        'const { botConfigData, deepgramApiKeyForBrowser, selectors } = pageArgs;'
    )
    
    # 6. Update BrowserWhisperLiveService destructoring
    content = content.replace(
        'const { BrowserAudioService, BrowserWhisperLiveService } = (window as any).VexaBrowserUtils;',
        'const { BrowserAudioService, BrowserDeepgramService } = (window as any).VexaBrowserUtils;'
    )
    
    # 7. Update browser service instantiation
    content = content.replace(
        'const whisperLiveService = transcriptionEnabled',
        'const deepgramService = transcriptionEnabled'
    )
    
    old_browser_init = """        ? new BrowserWhisperLiveService({
            whisperLiveUrl: whisperUrlForBrowser as string
          }, true) // Enable stubborn mode"""
    new_browser_init = """        ? new BrowserDeepgramService({
            deepgramApiKey: deepgramApiKeyForBrowser as string
          }, true) // Enable stubborn mode"""
    content = content.replace(old_browser_init, new_browser_init)
    
    old_gm_browser_init = """        ? new browserUtils.BrowserWhisperLiveService({
            whisperLiveUrl: whisperUrlForBrowser as string
          }, true) // Enable stubborn mode for Google Meet
        : null;"""
    new_gm_browser_init = """        ? new browserUtils.BrowserDeepgramService({
            deepgramApiKey: deepgramApiKeyForBrowser as string
          }, true) // Enable stubborn mode for Google Meet
        : null;"""
    content = content.replace(old_gm_browser_init, new_gm_browser_init)
    
    # 8. Replace global references
    content = content.replace('__vexaWhisperLiveService = whisperLiveService', '__vexaDeepgramService = deepgramService')
    content = content.replace('__vexaWhisperLiveService', '__vexaDeepgramService')
    content = content.replace('whisperLiveService', 'deepgramService')
    
    # 9. Fix connectToWhisperLive -> connectToDeepgram
    content = content.replace('connectToWhisperLive', 'connectToDeepgram')
    
    # 10. Update the page.evaluate arguments passed from Node.js
    content = content.replace('whisperUrlForBrowser: whisperLiveUrl,', 'deepgramApiKeyForBrowser: deepgramApiKey,')
    content = content.replace('whisperUrlForBrowser: whisperLiveUrl ', 'deepgramApiKeyForBrowser: deepgramApiKey ')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

update_platform('core/src/platforms/googlemeet/recording.ts')
update_platform('core/src/platforms/msteams/recording.ts')
