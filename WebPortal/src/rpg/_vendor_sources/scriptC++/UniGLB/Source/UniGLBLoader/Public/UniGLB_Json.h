// UniGLB - derived from VRM4U. Copyright (c) Haruyoshi Yamamoto (MIT); modifications (c) hanibes. See LICENSE.
#pragma once

#define RAPIDJSON_NAMESPACE uniglb::local::rapid_json
#define RAPIDJSON_NAMESPACE_BEGIN namespace uniglb { namespace local { namespace rapid_json {
#define RAPIDJSON_NAMESPACE_END } } }

#include <vector>
#include "rapidjson/document.h"

class UniGLBJson {

	bool bEnable = false;
public:
	RAPIDJSON_NAMESPACE::Document doc;

	bool validateSchema();
	bool init(const uint8_t* pData, size_t size);
	
	bool IsEnable() const{
		return bEnable;
	}
};
