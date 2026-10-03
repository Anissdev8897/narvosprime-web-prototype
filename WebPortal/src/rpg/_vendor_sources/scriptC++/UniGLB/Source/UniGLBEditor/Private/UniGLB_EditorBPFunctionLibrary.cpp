// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications Copyright (c) hanibes. See LICENSE.

#include "UniGLB_EditorBPFunctionLibrary.h"

#include "Engine/Engine.h"
#include "Logging/MessageLog.h"
#include "Engine/Canvas.h"
// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.
#include "AssetRegistry/AssetRegistryModule.h"

#include "MovieScene.h"
#include "MovieSceneSequence.h"
#include "Sections/MovieSceneFloatSection.h"

//#include "UniGLB.h"

//OnGlobalTimeChanged

int UUniGLBEditorBPFunctionLibrary::EvaluateCurvesFromSequence(const UMovieSceneSequence* Seq, float FrameNo, TArray<FString>& names, TArray<float> &curves) {
    names.Empty();
    curves.Empty();

// [UniGLB] collapsed dead UE_VERSION_OLDER_THAN guard(s) for [(4, 26, 0)] (target floor (5, 7, 0)); kept #else branch only.

    //if (Track == nullptr) return 0;

    if (Seq == nullptr) return 0;
    if (Seq->GetMovieScene() == nullptr) return 0;

    TArray<UMovieSceneSection*> Sections = Seq->GetMovieScene()->GetAllSections();
    //const auto &Sections = Track->GetAllSections();
    for (UMovieSceneSection* Section : Sections){
        UMovieSceneFloatSection* FloatSection = Cast<UMovieSceneFloatSection>(Section);
        //UMovieSceneControlRigParameterSection* s = Cast<UMovieSceneControlRigParameterSection>(Section);

        if (FloatSection == nullptr) {
            continue;
        }
        const FMovieSceneFloatChannel& Channel = FloatSection->GetChannel();
        float Value;
        FFrameTime Time((int)(FMath::Floor(FrameNo)), FMath::Frac(FrameNo));
        bool Success = Channel.Evaluate(Time, Value);
        if (Success) {
            curves.Add(Value);
            names.Add(FloatSection->GetName());
        }
    }
    return curves.Num();
}