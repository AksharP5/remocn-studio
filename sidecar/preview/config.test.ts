import { describe, expect, it } from "bun:test";
import {
  acceptedBy,
  type ConfigHost,
  compatibleWith,
  configFrom,
  EMPTY_CONFIG,
  optionsFor,
  type ResolvedConfig,
} from "./config";

interface FakeOption {
  getValue: () => { source: string; value: unknown };
  id: string;
  ssrName: string | null;
}

const option = (
  id: string,
  ssrName: string | null,
  value: unknown,
  source = "config"
): FakeOption => ({
  getValue: () => ({ source, value }),
  id,
  ssrName,
});

const mediaFn = ({
  codec,
  composition,
  serveUrl,
  ...rest
}: Record<string, unknown>) => [codec, composition, serveUrl, rest];

const stillFn = (options: unknown) => {
  const { composition, serveUrl, frame, jpegQuality } = options as Record<
    string,
    unknown
  >;
  return [composition, serveUrl, frame, jpegQuality];
};

const compositionFn = (options: unknown) => {
  const { id, serveUrl } = options as Record<string, unknown>;
  return [id, serveUrl];
};

function hostOf(options: Record<string, FakeOption>): ConfigHost {
  return {
    allOptions: options as unknown as ConfigHost["allOptions"],
    composition: compositionFn,
    configInternals: {},
    envVariables: {},
    ffmpegOverride: false,
    renderMedia: mediaFn,
    renderStill: stillFn,
    version: "4.0.520",
  };
}

describe("acceptedBy", () => {
  it("reads a parameter destructuring", () => {
    expect(acceptedBy(mediaFn)).toEqual([
      "codec",
      "composition",
      "serveUrl",
      "rest",
    ]);
  });

  it("reads a destructuring in the body, which is how renderStill is compiled", () => {
    expect(acceptedBy(stillFn)).toEqual([
      "composition",
      "serveUrl",
      "frame",
      "jpegQuality",
    ]);
  });

  it("answers nothing for what is not a function", () => {
    expect(acceptedBy(null)).toEqual([]);
    expect(acceptedBy({})).toEqual([]);
  });

  it("keeps renamed and defaulted fields under their own name", () => {
    const fn = ({ logLevel: level, scale = 1 }: Record<string, unknown>) => [
      level,
      scale,
    ];

    expect(acceptedBy(fn)).toEqual(["logLevel", "scale"]);
  });
});

describe("configFrom", () => {
  it("puts a browser option in chromiumOptions, whichever way it is spelled", () => {
    const config = configFrom(
      hostOf({
        gl: option("gl", "gl", "angle"),
        linux: option(
          "enable-multiprocess-on-linux",
          "chromiumOptions.enableMultiprocessOnLinux",
          true
        ),
      })
    );

    expect(config.chromium).toEqual({
      enableMultiProcessOnLinux: true,
      gl: "angle",
    });
    expect(config.options.gl).toBeUndefined();
  });

  it("keeps the two image formats apart", () => {
    const config = configFrom(
      hostOf({
        stills: option("still-image-format", "imageFormat", "png"),
        videos: option("video-image-format", "imageFormat", "jpeg"),
      })
    );

    expect(config.options["media:imageFormat"]).toEqual({
      source: "config",
      value: "jpeg",
    });
    expect(config.options["still:imageFormat"]).toEqual({
      source: "config",
      value: "png",
    });
  });

  it("reports an option the installed Remotion could not answer for", () => {
    const config = configFrom(
      hostOf({
        broken: {
          getValue: () => {
            throw new Error("needs a composition");
          },
          id: "sample-rate",
          ssrName: "sampleRate",
        },
      })
    );

    expect(config.problems.map((problem) => problem.id)).toEqual([
      "sample-rate",
    ]);
    expect(config.options.sampleRate).toBeUndefined();
  });

  it("says nothing about the options no config can set", () => {
    const config = configFrom(
      hostOf({
        codec: {
          getValue: () => {
            throw new Error("Cannot destructure property 'compositionCodec'");
          },
          id: "codec",
          ssrName: "codec",
        },
      })
    );

    expect(config.problems).toEqual([]);
  });

  it("refuses a value it could not carry between processes", () => {
    const config = configFrom(
      hostOf({
        override: option("ffmpeg-override", "ffmpegOverride", () => undefined),
      })
    );

    expect(config.problems.map((problem) => problem.id)).toEqual([
      "ffmpeg-override",
    ]);
  });

  it("falls back to the set it knows when it cannot read the signature", () => {
    const host = { ...hostOf({}), renderMedia: () => undefined };
    const config = configFrom(host);

    expect(config.accepts.media).toContain("crf");
    expect(config.problems.map((problem) => problem.id)).toContain(
      "renderMedia"
    );
  });
});

describe("optionsFor", () => {
  const config: ResolvedConfig = {
    ...EMPTY_CONFIG,
    accepts: {
      composition: ["timeoutInMilliseconds"],
      media: ["crf", "imageFormat", "scale", "codec", "timeoutInMilliseconds"],
      still: ["imageFormat", "jpegQuality"],
    },
    options: {
      crf: { source: "config", value: 18 },
      "media:imageFormat": { source: "config", value: "jpeg" },
      scale: { source: "config", value: 1 },
      "still:imageFormat": { source: "config", value: "png" },
      timeoutInMilliseconds: { source: "config", value: 60_000 },
    },
  };

  it("hands each caller the options it takes", () => {
    expect(optionsFor(config, "media")).toEqual({
      crf: 18,
      timeoutInMilliseconds: 60_000,
    });
    expect(optionsFor(config, "composition")).toEqual({
      timeoutInMilliseconds: 60_000,
    });
  });

  it("never forwards what the studio decides itself", () => {
    expect(optionsFor(config, "media").scale).toBeUndefined();
    expect(optionsFor(config, "media").imageFormat).toBeUndefined();
  });

  it("keeps a scoped option out of the other caller's set", () => {
    const wider: ResolvedConfig = {
      ...config,
      accepts: { ...config.accepts, still: ["imageFormat", "jpegQuality"] },
    };

    expect(optionsFor(wider, "still")).toEqual({});
  });
});

describe("compatibleWith", () => {
  it("keeps a CRF for the codecs that have one", () => {
    expect(compatibleWith("h264", { crf: 18 }).options).toEqual({ crf: 18 });
    expect(compatibleWith("vp9", { crf: 28 }).options).toEqual({ crf: 28 });
  });

  it("drops a CRF the codec would throw on", () => {
    const answered = compatibleWith("prores", { crf: 18 });

    expect(answered.options.crf).toBeUndefined();
    expect(answered.dropped.map((one) => one.name)).toEqual(["crf"]);
  });

  it("drops a ProRes profile from every other codec", () => {
    expect(compatibleWith("h264", { proResProfile: "hq" }).options).toEqual({});
    expect(compatibleWith("prores", { proResProfile: "hq" }).options).toEqual({
      proResProfile: "hq",
    });
  });

  it("leaves an unset option alone rather than reporting it", () => {
    const answered = compatibleWith("gif", {
      crf: null,
      proResProfile: undefined,
    });

    expect(answered.dropped).toEqual([]);
  });

  it("drops an audio codec the container cannot hold", () => {
    expect(compatibleWith("vp9", { audioCodec: "aac" }).dropped.length).toBe(1);
    expect(compatibleWith("vp9", { audioCodec: "opus" }).dropped).toEqual([]);
    expect(
      compatibleWith("gif", { audioCodec: "aac" }).dropped[0]?.reason
    ).toContain("no audio");
  });

  it("will not send a bitrate and a quality together", () => {
    const answered = compatibleWith("h264", { crf: 18, videoBitrate: "5M" });

    expect(answered.options.videoBitrate).toBeNull();
    expect(answered.dropped.map((one) => one.name)).toEqual(["videoBitrate"]);
  });

  it("will not send a maximum rate with no buffer beside it", () => {
    const answered = compatibleWith("h264", {
      encodingBufferSize: null,
      encodingMaxRate: "5M",
    });

    expect(answered.options.encodingMaxRate).toBeNull();
  });

  it("keeps the pair when both are there", () => {
    const answered = compatibleWith("h264", {
      encodingBufferSize: "10M",
      encodingMaxRate: "5M",
    });

    expect(answered.dropped).toEqual([]);
  });

  it("keeps GIF loops for a GIF and nothing else", () => {
    expect(compatibleWith("gif", { numberOfGifLoops: 2 }).options).toEqual({
      numberOfGifLoops: 2,
    });
    expect(compatibleWith("h264", { numberOfGifLoops: 2 }).options).toEqual({});
  });
});
