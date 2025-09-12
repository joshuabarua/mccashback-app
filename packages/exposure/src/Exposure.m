#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

@interface RCT_EXTERN_MODULE(Exposure, NSObject)

RCT_EXTERN_METHOD(getExposureCapabilities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setManualExposure:(nonnull NSNumber *)exposureNs
                  iso:(nullable NSNumber *)iso
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(enableAutoExposure:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setTargetFps:(nonnull NSNumber *)targetFps
                  preferLowResolution:(nullable NSNumber *)preferLowResolution
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resetFrameRate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
